using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace BotPress;

// ตั้งค่า page (ui/settings.js): LLM profiles, the owner's news-source list and the YouTube -> digest pipeline.
// Profiles are llm.json files in <infra>\llm-profiles (Paths.Infra); "use" copies one over %LOCALAPPDATA%\BotPress\llm.json and restarts the
// app through the launcher, which rewrites RAKAZO_LOCAL_* in ~/rakazo/.env (LlmConfig is read once at startup, so a restart is needed).
public static class Settings
{
    public static readonly string ProfilesDir = Path.Combine(Monitor.Root, "llm-profiles");
    static readonly string Launcher = Paths.Launcher;
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(4) };
    static readonly Regex IdRx = new("^[a-z0-9][a-z0-9-]{0,59}$");

    // ---------- LLM profiles ----------
    static string ProfileFile(string id) => IdRx.IsMatch(id) ? Path.Combine(ProfilesDir, id + ".json") : throw new ArgumentException("รหัสโปรไฟล์ไม่ถูกต้อง");

    public static async Task<object> Profiles()
    {
        Directory.CreateDirectory(ProfilesDir);
        var list = Directory.GetFiles(ProfilesDir, "*.json").OrderBy(f => f).Select(f =>
        {
            var j = JsonNode.Parse(File.ReadAllText(f))!.AsObject();
            string S(string k) => j[k]?.GetValue<string>() ?? "";
            int I(string k) => j[k] is JsonValue v && v.TryGetValue<int>(out var n) ? n : 0;
            var health = S("healthUrl").TrimEnd('/');
            return new { id = Path.GetFileNameWithoutExtension(f), label = S("label"), healthUrl = health, modelId = S("modelId"),
                contextWindow = I("contextWindow"), maxTokens = I("maxTokens"), vision = j["vision"]?.GetValue<bool>() == true,
                active = health == LlmConfig.HealthUrl && S("modelId") == LlmConfig.ModelId };
        }).ToList();
        var probes = await Task.WhenAll(list.Select(p => Probe(p.healthUrl, p.modelId)));
        return new
        {
            current = new { label = LlmConfig.Label, healthUrl = LlmConfig.HealthUrl, modelId = LlmConfig.ModelId, remote = LlmConfig.Remote },
            profiles = list.Zip(probes, (p, s) => new { p.id, p.label, p.healthUrl, p.modelId, p.contextWindow, p.maxTokens, p.vision, p.active, status = s }),
        };
    }

    // which server answers at url and whether it has the model: llama-server / tensorfold have /health, Ollama has /api/version
    public static async Task<object> Probe(string url, string model)
    {
        var sw = Stopwatch.StartNew();
        async Task<string?> Get(string path) { try { var r = await Http.GetAsync(url + path); return r.IsSuccessStatusCode ? await r.Content.ReadAsStringAsync() : null; } catch { return null; } }
        // both at once: a machine that is off costs one timeout (4 s), not two
        var verTask = Get("/api/version");
        var healthTask = Get("/health");
        if (await verTask is { } ver)
        {
            var names = Names(await Get("/api/tags"), "models", "name");
            var ok = names.Contains(model);
            return new { ok, kind = "Ollama " + (JsonNode.Parse(ver)?["version"]?.GetValue<string>() ?? ""), ms = sw.ElapsedMilliseconds,
                detail = ok ? "พร้อม" : $"เครื่องตอบ แต่ไม่มีโมเดล {model}" };
        }
        if (await healthTask is { } h)
        {
            var names = Names(await Get("/v1/models"), "data", "id");
            var ok = names.Count == 0 || names.Contains(model);
            var busy = JsonNode.Parse(h) is JsonObject o && o["busy"] is JsonValue b ? $" · busy {b}" : "";
            return new { ok, kind = "OpenAI-compatible", ms = sw.ElapsedMilliseconds, detail = ok ? "พร้อม" + busy : $"เครื่องตอบ แต่ไม่มีโมเดล {model}" };
        }
        return new { ok = false, kind = "", ms = sw.ElapsedMilliseconds, detail = "ไม่ตอบ (เครื่องปิด, service ไม่ได้เปิด หรือ Tailscale หลุด)" };
    }

    static List<string> Names(string? json, string arr, string key)
    {
        try { return JsonNode.Parse(json ?? "{}")![arr]!.AsArray().Select(m => m![key]!.GetValue<string>()).ToList(); } catch { return []; }
    }

    // models a server offers, for the "add profile" form (Ollama tags, else the OpenAI /v1/models list)
    public static async Task<object> Models(string url)
    {
        url = CheckUrl(url);
        async Task<string?> Get(string path) { try { var r = await Http.GetAsync(url + path); return r.IsSuccessStatusCode ? await r.Content.ReadAsStringAsync() : null; } catch { return null; } }
        if (await Get("/api/tags") is { } tags) return new { kind = "ollama", models = Names(tags, "models", "name") };
        if (await Get("/v1/models") is { } m) return new { kind = "openai", models = Names(m, "data", "id") };
        throw new InvalidOperationException("ไม่มีเซิร์ฟเวอร์ LLM ตอบที่ " + url + " (ตรวจ IP, port และว่าเครื่องนั้นเปิด service อยู่)");
    }

    static string CheckUrl(string url)
    {
        url = url.Trim().TrimEnd('/');
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != "http" && u.Scheme != "https") || u.AbsolutePath != "/")
            throw new ArgumentException("URL ต้องเป็นแบบ http://IP:port (ไม่ต้องมี /v1)");
        return url;
    }

    public static object SaveProfile(JsonNode a)
    {
        string S(string k) => a[k]?.GetValue<string>()?.Trim() ?? "";
        int I(string k, int lo, int hi, int d) => a[k] is JsonValue v && v.TryGetValue<int>(out var n) ? Math.Clamp(n, lo, hi) : d;
        var label = S("label");
        if (label.Length is 0 or > 80) throw new ArgumentException("ต้องมีชื่อโปรไฟล์ (ไม่เกิน 80 ตัวอักษร)");
        var url = CheckUrl(S("url"));
        var model = S("modelId");
        if (model.Length is 0 or > 120) throw new ArgumentException("ต้องเลือกโมเดล");
        var key = S("apiKey");
        var id = S("id") is { Length: > 0 } given ? given
            : Regex.Replace((model + "-" + new Uri(url).Host).ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        if (id.Length > 60) id = id[..60].TrimEnd('-');
        var file = ProfileFile(id);
        var j = new JsonObject
        {
            ["remote"] = true, ["healthUrl"] = url, ["provider"] = "local", ["baseUrl"] = url + "/v1", ["modelId"] = model, ["label"] = label,
            // Rakazo stores a key of 8+ characters even for servers without auth
            ["apiKey"] = key.Length >= 8 ? key : "local-no-auth",
            ["contextWindow"] = I("contextWindow", 4096, 1048576, 65536), ["maxTokens"] = I("maxTokens", 1024, 131072, 16384),
            ["vision"] = a["vision"]?.GetValue<bool>() == true,
        };
        Directory.CreateDirectory(ProfilesDir);
        File.WriteAllText(file, j.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        return new { id };
    }

    public static void DeleteProfile(string id)
    {
        var f = ProfileFile(id);
        var j = JsonNode.Parse(File.ReadAllText(f))!;
        if (j["healthUrl"]?.GetValue<string>()?.TrimEnd('/') == LlmConfig.HealthUrl && j["modelId"]?.GetValue<string>() == LlmConfig.ModelId)
            throw new InvalidOperationException("ลบโปรไฟล์ที่กำลังใช้อยู่ไม่ได้ สลับไปโปรไฟล์อื่นก่อน");
        File.Delete(f);
    }

    // copy the profile over llm.json (old one kept as llm.json.bak), then hand over to the launcher: it waits for this process to
    // exit, syncs ~/rakazo/.env, recreates the Rakazo containers and starts the app again (RakazoClient then reconnects the model)
    public static object UseProfile(string id, int devtoolsPort)
    {
        var src = ProfileFile(id);
        JsonNode.Parse(File.ReadAllText(src)); // a broken profile must not replace a working llm.json
        Directory.CreateDirectory(Path.GetDirectoryName(LlmConfig.File)!);
        if (File.Exists(LlmConfig.File)) File.Copy(LlmConfig.File, LlmConfig.File + ".bak", true);
        File.Copy(src, LlmConfig.File, true);
        var args = $"-NoProfile -ExecutionPolicy Bypass -File \"{Launcher}\" -WaitPid {Environment.ProcessId}" + (devtoolsPort > 0 ? " -Dev" : "");
        Process.Start(new ProcessStartInfo("powershell.exe", args) { UseShellExecute = false, CreateNoWindow = true });
        return new { restarting = true };
    }

    // ---------- news sources ----------
    static readonly string SourcesFile = Path.Combine(Newsdesk.NewsDir, "sources.json");
    static readonly string SourcesDefault = Path.Combine(Paths.App, "newsdesk", "sources-default.json");
    static readonly string[] Types = ["web", "rss", "youtube", "social", "other"];
    static readonly string[] Beats = ["ai", "gadget", "software", "startup", "security", "gaming", "cloud", "policy", "other"]; // newsdesk/server.mjs BEATS

    public static JsonNode Sources()
    {
        if (!File.Exists(SourcesFile)) return new JsonObject { ["sources"] = new JsonArray(), ["exists"] = false };
        var j = JsonNode.Parse(File.ReadAllText(SourcesFile))!;
        j["exists"] = true;
        return j;
    }

    public static JsonNode SeedSources()
    {
        if (File.Exists(SourcesFile) && (JsonNode.Parse(File.ReadAllText(SourcesFile))?["sources"]?.AsArray().Count ?? 0) > 0)
            throw new InvalidOperationException("มีรายการแหล่งข่าวอยู่แล้ว (ชุดเริ่มต้นใช้ได้เมื่อรายการว่างเท่านั้น)");
        return SaveSources(JsonNode.Parse(File.ReadAllText(SourcesDefault))!["sources"]!);
    }

    // the whole list is validated and written at once (tmp + rename, like the newsdesk server, which reads it on every call)
    public static JsonNode SaveSources(JsonNode list)
    {
        var arr = list.AsArray();
        if (arr.Count > 500) throw new ArgumentException("แหล่งข่าวได้สูงสุด 500 รายการ");
        var clean = new JsonArray();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in arr)
        {
            string S(string k, int max) { var v = s?[k]?.GetValue<string>()?.Trim() ?? ""; return v.Length > max ? v[..max] : v; }
            var name = S("name", 120);
            var url = S("url", 500);
            if (name.Length == 0) throw new ArgumentException("ทุกแหล่งต้องมีชื่อ");
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != "https" && u.Scheme != "http")) throw new ArgumentException($"URL ของ \"{name}\" ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)");
            if (!seen.Add(u.AbsoluteUri)) throw new ArgumentException($"URL ซ้ำ: {u.AbsoluteUri}");
            var type = S("type", 20) is var t && Types.Contains(t) ? t : "web";
            var beats = new JsonArray(((s?["beats"] as JsonArray) ?? []).Select(b => b?.GetValue<string>()).Where(b => b != null && Beats.Contains(b)).Distinct().Select(b => (JsonNode)b!).ToArray());
            clean.Add(new JsonObject { ["name"] = name, ["url"] = u.AbsoluteUri, ["type"] = type, ["beats"] = beats, ["note"] = S("note", 300), ["enabled"] = s?["enabled"]?.GetValue<bool>() != false });
        }
        var doc = new JsonObject { ["version"] = 1, ["updated"] = DateTime.Now.ToString("s"), ["sources"] = clean };
        Directory.CreateDirectory(Newsdesk.NewsDir);
        File.WriteAllText(SourcesFile + ".tmp", doc.ToJsonString(new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
        File.Move(SourcesFile + ".tmp", SourcesFile, true);
        doc["exists"] = true;
        return doc;
    }

    // ---------- tools for YouTube / NotebookLM ----------
    static async Task<(int code, string output)> Exec(string exe, string args, int ms = 15000, string? cwd = null)
    {
        try
        {
            var psi = new ProcessStartInfo(exe, args) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, WorkingDirectory = cwd ?? "" };
            using var p = Process.Start(psi)!;
            var o = p.StandardOutput.ReadToEndAsync();
            var e = p.StandardError.ReadToEndAsync();
            using var cts = new CancellationTokenSource(ms);
            try { await p.WaitForExitAsync(cts.Token); } catch (OperationCanceledException) { try { p.Kill(true); } catch { } return (-2, "หมดเวลา"); }
            return (p.ExitCode, (await o) + (await e));
        }
        catch (System.ComponentModel.Win32Exception) { return (-1, ""); } // not installed / not on PATH
    }

    public static async Task<object> ToolsStatus()
    {
        static string First(string s) => s.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0) ?? "";
        var checks = new (string id, string exe, string args)[] { ("node", "node", "--version"), ("ytdlp", "yt-dlp", "--version"),
            ("ffmpeg", "ffmpeg", "-hide_banner -version"), ("uv", "uv", "--version"), ("notebooklm", "notebooklm", "--version") };
        var res = await Task.WhenAll(checks.Select(async c => { var (code, o) = await Exec(c.exe, c.args); return (c.id, ok: code == 0, ver: code == 0 ? First(o) : ""); }));
        var nb = res.First(r => r.id == "notebooklm").ok;
        var auth = nb && (await Exec("notebooklm", "auth check --json", 30000)).code == 0;
        return new
        {
            tools = res.ToDictionary(r => r.id, r => new { r.ok, version = r.ver.Length > 80 ? r.ver[..80] : r.ver }),
            notebooklmAuth = auth,
            engine = auth ? "notebooklm" : "llm:" + LlmConfig.ModelId,
        };
    }

    // explicit owner actions from the page (the page asks first): both open a visible console so the owner sees what happens
    public static void InstallNotebookLm() =>
        Process.Start(new ProcessStartInfo("cmd.exe", "/k uv tool install \"notebooklm-py[browser]\" && echo. && echo ติดตั้งเสร็จ กลับไปที่ iHC-Press แล้วกด เข้าสู่ระบบ Google") { UseShellExecute = true });
    public static void LoginNotebookLm() =>
        Process.Start(new ProcessStartInfo("cmd.exe", "/k chcp 65001 >nul && notebooklm login && notebooklm auth check --test") { UseShellExecute = true });

    // ---------- YouTube digests ----------
    static readonly string YtDir = Path.Combine(Newsdesk.NewsDir, "youtube");
    static readonly string YtScript = Path.Combine(Paths.App, "tools", "yt-digest.mjs");
    static readonly SemaphoreSlim YtGate = new(1, 1); // one clip at a time: the LLM and the download share the same machine
    static string? _ytBusy;

    static string VideoId(string url) =>
        Regex.Match(url, @"(?:v=|youtu\.be/|shorts/|live/)([\w-]{11})") is { Success: true } m ? m.Groups[1].Value : throw new ArgumentException("ลิงก์นี้ไม่ใช่คลิป YouTube");

    public static async Task<JsonNode> Digest(string url)
    {
        var id = VideoId(url);
        await YtGate.WaitAsync();
        _ytBusy = id;
        try
        {
            var (code, output) = await Exec("node", $"\"{YtScript}\" \"https://www.youtube.com/watch?v={id}\" --out \"{YtDir}\"", 20 * 60000);
            var last = output.Split('\n').Select(l => l.Trim()).LastOrDefault(l => l.StartsWith('{'));
            var r = last != null ? JsonNode.Parse(last)! : new JsonObject { ["ok"] = false, ["error"] = code == -1 ? "ไม่พบ node" : output.Trim()[..Math.Min(300, output.Trim().Length)] };
            if (r["ok"]?.GetValue<bool>() != true)
            {
                Directory.CreateDirectory(Path.Combine(YtDir, id));
                File.WriteAllText(Path.Combine(YtDir, id, "error.json"), new JsonObject { ["error"] = r["error"]?.GetValue<string>() ?? "ไม่ทราบสาเหตุ", ["at"] = DateTime.Now.ToString("s") }.ToJsonString());
                throw new InvalidOperationException(r["error"]?.GetValue<string>() ?? "สรุปคลิปไม่สำเร็จ");
            }
            File.Delete(Path.Combine(YtDir, id, "error.json"));
            return r;
        }
        finally { _ytBusy = null; YtGate.Release(); }
    }

    // requests the bots queued with the newsdesk tool youtube_digest; the window calls this every 15 s
    public static async Task ProcessYtQueue()
    {
        var dir = Path.Combine(YtDir, "requests");
        if (!Directory.Exists(dir) || YtGate.CurrentCount == 0) return;
        foreach (var f in Directory.GetFiles(dir, "*.json").OrderBy(File.GetLastWriteTimeUtc))
        {
            string url;
            try { url = JsonNode.Parse(File.ReadAllText(f))!["url"]!.GetValue<string>(); } catch { File.Delete(f); continue; }
            try { await Digest(url); } catch { /* error.json tells the bot on its next call */ }
            File.Delete(f);
        }
    }

    public static object YtList()
    {
        Directory.CreateDirectory(YtDir);
        var done = Directory.GetDirectories(YtDir).Select(d => Path.Combine(d, "digest.json")).Where(File.Exists).Select(f =>
        {
            var j = JsonNode.Parse(File.ReadAllText(f))!;
            return new { id = j["id"]?.GetValue<string>(), title = j["title"]?.GetValue<string>(), channel = j["channel"]?.GetValue<string>(),
                engine = j["engine"]?.GetValue<string>(), at = j["at"]?.GetValue<string>(), points = j["key_points"]?.AsArray().Count ?? 0, frames = j["frames"]?.AsArray().Count ?? 0 };
        }).OrderByDescending(x => x.at).Take(50).ToList();
        var reqDir = Path.Combine(YtDir, "requests");
        var queued = Directory.Exists(reqDir) ? Directory.GetFiles(reqDir, "*.json").Select(f =>
        {
            try { var j = JsonNode.Parse(File.ReadAllText(f))!; return new { id = j["id"]?.GetValue<string>(), by = j["by"]?.GetValue<string>(), at = j["at"]?.GetValue<string>() }; }
            catch { return null; }
        }).Where(x => x != null).ToList() : [];
        return new { done, queued, busy = _ytBusy };
    }

    // digest + frames as data: URIs (the page's CSP only allows its own files and data:)
    public static JsonNode YtGet(string id)
    {
        if (!Regex.IsMatch(id, @"^[\w-]{11}$")) throw new ArgumentException("รหัสคลิปไม่ถูกต้อง");
        var d = Path.Combine(YtDir, id);
        var j = JsonNode.Parse(File.ReadAllText(Path.Combine(d, "digest.json")))!;
        foreach (var f in j["frames"]?.AsArray() ?? [])
        {
            var file = Path.GetFullPath(Path.Combine(d, f!["file"]!.GetValue<string>()));
            if (file.StartsWith(d, StringComparison.OrdinalIgnoreCase) && File.Exists(file))
                f["src"] = "data:image/jpeg;base64," + Convert.ToBase64String(File.ReadAllBytes(file));
        }
        return j;
    }

    public static void YtFolder(string id)
    {
        var d = Regex.IsMatch(id, @"^[\w-]{11}$") ? Path.Combine(YtDir, id) : YtDir;
        Directory.CreateDirectory(d);
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{d}\"") { UseShellExecute = true });
    }
}
