using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BotPress;

// Host side of the news board: reads the stories.json that the newsdesk MCP server (newsdesk/server.mjs, in its own
// container) keeps up to date, and opens the news folder. Read-only here; bots change stories only through the MCP tools.
public static class Newsdesk
{
    public static readonly string NewsDir = Paths.News; // paths.json "news" (originally D:\botpress\news)
    static readonly string StoriesFile = Path.Combine(NewsDir, "stories.json");

    public static JsonNode List()
    {
        string text;
        try
        {
            // the server writes tmp + rename: Delete sharing lets that rename replace the file while we read it
            using var fs = new FileStream(StoriesFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            text = new StreamReader(fs).ReadToEnd();
        }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException)
        {
            return new JsonObject { ["seq"] = new JsonObject(), ["stories"] = new JsonArray() }; // nothing pitched yet
        }
        try
        {
            if (JsonNode.Parse(text) is JsonObject o && o["stories"] is JsonArray list)
            {
                foreach (var st in list.OfType<JsonObject>()) // board thumbnails: the square render of each story that has artwork
                    if (st["id"]?.GetValue<string>() is { } id && StoryId.IsMatch(id) && Meta(id)?["files"]?["1x1"]?.GetValue<string>() is { } sq
                        && File.Exists(Path.Combine(ArtDir, id, sq)))
                        st["art"] = Url(id, sq);
                return o;
            }
        }
        catch (JsonException) { }
        throw new InvalidOperationException("อ่านไฟล์ข่าว stories.json ไม่ได้ (รูปแบบไม่ถูกต้อง) — ลองเปิดโฟลเดอร์ข่าวเพื่อตรวจไฟล์");
    }

    public static void Folder()
    {
        Directory.CreateDirectory(NewsDir);
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{NewsDir}\"") { UseShellExecute = true });
    }

    // ---------- news artwork: tools/news-art/render.mjs (Flow pictures + real Thai text) ----------
    // Pictures are read straight from <news>/art through a WebView2 virtual host, so the board never ships megabytes of base64.
    public const string ArtHost = "art.botpress.example";
    public static readonly string ArtDir = Path.Combine(NewsDir, "art");
    static readonly string ArtScript = Path.Combine(AppContext.BaseDirectory, "tools", "news-art", "render.mjs");
    static readonly SemaphoreSlim ArtGate = new(1, 1); // one render at a time: the button and the background pass share one browser
    static readonly System.Text.RegularExpressions.Regex StoryId = new(@"^[\w-]{1,40}$");
    static readonly string[] Variants = ["photo", "breaking", "card"];

    static string CheckId(string? id) => id is { } s && StoryId.IsMatch(s) ? s : throw new ArgumentException("รหัสข่าวไม่ถูกต้อง");
    static string Url(string id, string file) =>
        $"https://{ArtHost}/{Uri.EscapeDataString(id)}/{Uri.EscapeDataString(file)}?v={File.GetLastWriteTimeUtc(Path.Combine(ArtDir, id, file)).Ticks}";

    static JsonObject? Meta(string id)
    {
        try { return JsonNode.Parse(File.ReadAllText(Path.Combine(ArtDir, id, "meta.json"))) as JsonObject; }
        catch { return null; } // none yet, or being rewritten right now
    }

    // meta.json + a URL per format (only files that exist)
    public static JsonNode Art(string id)
    {
        var m = Meta(CheckId(id));
        if (m == null) return new JsonObject { ["exists"] = false };
        var urls = new JsonObject();
        if (m["files"] is JsonObject f)
            foreach (var (fmt, name) in f)
                if (name?.GetValue<string>() is { } n && File.Exists(Path.Combine(ArtDir, id, n))) urls[fmt] = Url(id, n);
        m["urls"] = urls;
        m["exists"] = urls.Count > 0;
        return m;
    }

    static async Task<JsonNode> Run(string args, int ms)
    {
        var (code, output) = await Settings.Exec("node", $"\"{ArtScript}\" {args}", ms);
        if (code == -1) throw new InvalidOperationException("ไม่พบ node — ติดตั้ง Node.js ก่อนสร้างภาพข่าว");
        var last = output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).LastOrDefault(l => l.StartsWith('{'));
        JsonNode? r = null;
        try { if (last != null) r = JsonNode.Parse(last); } catch (System.Text.Json.JsonException) { }
        return r ?? new JsonObject { ["ok"] = false, ["error"] = code == -2 ? "หมดเวลา" : output.Trim() };
    }

    // the button in the story reader: variant = what the person picked (kept on later automatic re-renders), "" = follow the brief
    public static async Task<JsonNode> RenderArt(string id, string? variant)
    {
        CheckId(id);
        if (!string.IsNullOrEmpty(variant) && !Variants.Contains(variant)) throw new ArgumentException("แบบภาพไม่ถูกต้อง");
        await ArtGate.WaitAsync();
        try
        {
            var r = await Run($"--story {id}" + (string.IsNullOrEmpty(variant) ? "" : $" --variant {variant}"), 120000);
            if (r["ok"]?.GetValue<bool>() != true) throw new InvalidOperationException("สร้างภาพข่าวไม่สำเร็จ: " + (r["error"]?.ToString() ?? "ไม่ทราบสาเหตุ"));
            return Art(id);
        }
        finally { ArtGate.Release(); }
    }

    // background pass (MainWindow, every 30 s): stories that reached ready/published get artwork without anyone asking
    public static async Task ProcessArt()
    {
        if (!File.Exists(StoriesFile) || !await ArtGate.WaitAsync(0)) return;
        try { await Run("--pending", 600000); }
        finally { ArtGate.Release(); }
    }

    public static void ArtFolder(string id)
    {
        var d = Path.Combine(ArtDir, CheckId(id));
        Directory.CreateDirectory(d);
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{d}\"") { UseShellExecute = true });
    }
}
