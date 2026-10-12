using System.IO;
using System.Text.Json;

namespace BotPress;

// Where the bots' LLM lives. Without %LOCALAPPDATA%\BotPress\llm.json this is the original layout: llama-server + Gemma 4 on
// this PC (:8080), reached by Rakazo through the socat bridge on docker0. With "remote": true the LLM runs on another machine
// (e.g. OpenThai on the DGX Spark over Tailscale): this app only watches its health and never starts, stops or restarts it.
public static class LlmConfig
{
    public static readonly string File = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BotPress", "llm.json");

    public static readonly bool Remote;
    public static readonly string HealthUrl = "http://127.0.0.1:8080";          // Monitor: /health, /v1/models, /slots, /metrics
    public static readonly string Provider = "openai-compatible";               // Rakazo provider: "openai-compatible" or "local" (RAKAZO_LOCAL_* env)
    public static readonly string BaseUrl = "http://172.17.0.1:18080/v1";      // openai-compatible only: URL as Rakazo's containers see it
    public static readonly string ModelId = "gemma4";
    public static readonly string Label = "Gemma 4 (เครื่องนี้)";
    public static readonly string? ApiKey;                                       // null = the "rakazo-" line of llm-api-key.txt
    public static readonly bool Reasoning;

    static LlmConfig()
    {
        if (!System.IO.File.Exists(File)) return;
        var j = JsonDocument.Parse(System.IO.File.ReadAllText(File)).RootElement; // a broken file should fail loudly at startup
        string S(string k, string d) => j.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : d;
        bool B(string k) => j.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.True;
        Remote = B("remote");
        HealthUrl = S("healthUrl", HealthUrl).TrimEnd('/');
        Provider = S("provider", Provider);
        BaseUrl = S("baseUrl", BaseUrl);
        ModelId = S("modelId", ModelId);
        Label = S("label", Label);
        ApiKey = j.TryGetProperty("apiKey", out var k) && k.ValueKind == JsonValueKind.String ? k.GetString() : null;
        Reasoning = B("reasoning");
    }
}
