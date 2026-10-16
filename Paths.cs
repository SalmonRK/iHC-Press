using System.IO;
using System.Text.Json.Nodes;

namespace BotPress;

// Where things live on this machine. %LOCALAPPDATA%\BotPress\paths.json (next to llm.json / owner.json) splits the code from
// the install, so the news data and infra can grow on another drive without touching the repo:
//   { "news": "D:\\AI-ART\\BotPress\\data\\news", "infra": "D:\\AI-ART\\BotPress\\localai",
//     "launcher": "D:\\AI-ART\\BotPress\\tools\\Start-BotPress.ps1" }
// Env BOTPRESS_NEWS_DIR / BOTPRESS_INFRA_DIR / BOTPRESS_LAUNCHER win over the file; without either this is the original
// layout (D:\botpress\news, D:\localai). The app's own files (ui/, newsdesk/, tools/yt-digest.mjs, botpress.sh) ship next to
// the exe. Paths must not contain spaces: botpress.sh is run through "wsl --exec", which splits on them.
public static class Paths
{
    public static readonly string ConfigFile = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BotPress", "paths.json");

    public static readonly string App = AppContext.BaseDirectory.TrimEnd('\\');
    public static readonly string News = Pick("BOTPRESS_NEWS_DIR", "news", @"D:\botpress\news");
    public static readonly string Infra = Pick("BOTPRESS_INFRA_DIR", "infra", @"D:\localai");
    public static readonly string Launcher = Pick("BOTPRESS_LAUNCHER", "launcher", @"D:\AI-ART\BotPress\tools\Start-BotPress.ps1");

    static JsonNode? _file;
    static string Pick(string env, string key, string fallback)
    {
        if (Environment.GetEnvironmentVariable(env) is { Length: > 0 } e) return Path.GetFullPath(e).TrimEnd('\\');
        try { _file ??= File.Exists(ConfigFile) ? JsonNode.Parse(File.ReadAllText(ConfigFile)) : new JsonObject(); }
        catch { _file = new JsonObject(); } // a broken paths.json must not stop the app: fall back to the original layout
        return _file?[key]?.GetValue<string>() is { Length: > 0 } v ? Path.GetFullPath(v).TrimEnd('\\') : fallback;
    }

    // D:\AI-ART\BotPress\app -> /mnt/d/AI-ART/BotPress/app (WSL's default automount)
    public static string Wsl(string win) =>
        win.Length >= 2 && win[1] == ':' ? "/mnt/" + char.ToLowerInvariant(win[0]) + win[2..].Replace('\\', '/') : win.Replace('\\', '/');
}
