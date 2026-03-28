import { useState, useRef, useEffect, useCallback } from "react";
import config from "./config";
import { supabase } from "./supabase";

const MONO = "'Courier New', Courier, monospace";

const LEVELS = {
  SAFE:    { label: "安全", color: "#00ff88", bg: "rgba(0,255,136,0.08)", icon: "●" },
  CAUTION: { label: "注意", color: "#ffcc00", bg: "rgba(255,204,0,0.08)",  icon: "▲" },
  ALERT:   { label: "警戒", color: "#ff4444", bg: "rgba(255,68,68,0.12)",  icon: "■" },
};

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbInsertEvent({ level, message, imagePath }) {
  const { error } = await supabase.from("events").insert({ level, message, image_path: imagePath });
  if (error) throw new Error(error.message);
}

async function sbUploadImage(blob, path) {
  const { error } = await supabase.storage.from("captures").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

async function sbFetchEvents(limit = 30) {
  const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

async function sbGetSignedUrl(path) {
  const { data, error } = await supabase.storage.from("captures").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ── tiny components ───────────────────────────────────────────────────────────
function Scanline() {
  return (
    <div style={{
      position:"absolute",inset:0,pointerEvents:"none",zIndex:5,
      background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.13) 2px,rgba(0,0,0,0.13) 4px)",
      borderRadius:"inherit",
    }}/>
  );
}

function Corner({ style }) {
  return <div style={{ position:"absolute", width:14, height:14, ...style }}/>;
}

function CRTFrame() {
  const c = "#00ff88";
  return <>
    <Corner style={{ top:6, left:6,   borderTop:`1.5px solid ${c}`, borderLeft:`1.5px solid ${c}` }}/>
    <Corner style={{ top:6, right:6,  borderTop:`1.5px solid ${c}`, borderRight:`1.5px solid ${c}` }}/>
    <Corner style={{ bottom:6,left:6, borderBottom:`1.5px solid ${c}`,borderLeft:`1.5px solid ${c}` }}/>
    <Corner style={{ bottom:6,right:6,borderBottom:`1.5px solid ${c}`,borderRight:`1.5px solid ${c}` }}/>
  </>;
}

function Blink({ children, ms = 900 }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setInterval(() => setOn(v => !v), ms); return () => clearInterval(t); }, [ms]);
  return <span style={{ opacity: on ? 1 : 0.15 }}>{children}</span>;
}

function Btn({ onClick, disabled, color = "#00ff88", children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: MONO, fontSize: 11, letterSpacing: 2, cursor: disabled ? "default" : "pointer",
      padding: "9px 14px", background: "transparent",
      border: `1px solid ${disabled ? "rgba(0,255,136,0.2)" : color}`,
      color: disabled ? "rgba(0,255,136,0.3)" : color,
      transition: "all 0.15s", ...style,
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >{children}</button>
  );
}

// ── Gallery modal ─────────────────────────────────────────────────────────────
function Gallery({ events, onClose }) {
  const [imgs, setImgs] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    events.forEach(async ev => {
      if (ev.image_path && !fetchedRef.current.has(ev.image_path)) {
        fetchedRef.current.add(ev.image_path);
        const signed = await sbGetSignedUrl(ev.image_path);
        if (signed) setImgs(p => ({ ...p, [ev.image_path]: signed }));
      }
    });
  }, [events]);

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100,
      display:"flex", flexDirection:"column", fontFamily:MONO,
    }}>
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"12px 20px", borderBottom:"1px solid rgba(0,255,136,0.2)", color:"#00ff88",
      }}>
        <span style={{ fontSize:11, letterSpacing:3 }}>EVENT GALLERY — {events.length} RECORDS</span>
        <Btn onClick={onClose} color="#ff4444">✕ 閉じる</Btn>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:20,
        display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
        {events.map(ev => {
          const lv = LEVELS[ev.level] || LEVELS.SAFE;
          return (
            <div key={ev.id} style={{
              border:`1px solid ${lv.color}40`, background:lv.bg, padding:10,
            }}>
              {ev.image_path && imgs[ev.image_path]
                ? <img src={imgs[ev.image_path]} alt="" style={{ width:"100%", aspectRatio:"16/10", objectFit:"cover", marginBottom:8 }}/>
                : <div style={{ width:"100%", aspectRatio:"16/10", background:"#0a100a", marginBottom:8,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, color:"rgba(0,255,136,0.2)" }}>NO IMAGE</div>
              }
              <div style={{ fontSize:10, color:lv.color, marginBottom:4 }}>{lv.icon} {lv.label}</div>
              <div style={{ fontSize:10, color:"#aaa", lineHeight:1.5 }}>{ev.message}</div>
              <div style={{ fontSize:9, color:"#555", marginTop:6 }}>
                {new Date(ev.created_at).toLocaleString("ja-JP")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main monitor ──────────────────────────────────────────────────────────────
function Monitor({ session }) {
  const userId = session.user.id;
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const timerRef    = useRef(null);
  const [camActive, setCamActive] = useState(false);
  const [captured,  setCaptured]  = useState(null);
  const [uploaded,  setUploaded]  = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [logs,      setLogs]      = useState([]);
  const [curLevel,  setCurLevel]  = useState(null);
  const [time,      setTime]      = useState("");
  const [autoMin,   setAutoMin]   = useState(1);
  const [autoOn,    setAutoOn]    = useState(false);
  const [gallery,   setGallery]   = useState(false);
  const [dbEvents,  setDbEvents]  = useState([]);
  const [camErr,    setCamErr]    = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("ja-JP")), 1000);
    return () => clearInterval(t);
  }, []);

  const captureAndAnalyzeRef = useRef(null);

  // auto capture loop
  useEffect(() => {
    clearInterval(timerRef.current);
    if (autoOn && camActive) {
      timerRef.current = setInterval(() => captureAndAnalyzeRef.current?.(), autoMin * 60 * 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [autoOn, autoMin, camActive]);

  const startCam = async () => {
    setCamErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      await videoRef.current.play();
      setCamActive(true);
    } catch { setCamErr("カメラアクセス拒否。画像アップロードを使ってください。"); }
  };

  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActive(false); setCaptured(null); setAutoOn(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const c = document.createElement("canvas");
    c.width = videoRef.current.videoWidth || 640;
    c.height = videoRef.current.videoHeight || 480;
    c.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    setCaptured(dataUrl);
    setUploaded(null);
    return dataUrl;
  };

  const analyzeImage = useCallback(async (imgData) => {
    if (!imgData || analyzing) return null;
    setAnalyzing(true);
    const b64 = imgData.split(",")[1];
    const mt  = imgData.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    try {
      const res = await fetch("/api/anthropic", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key": config.anthropic.apiKey,
        },
        body: JSON.stringify({
          model:"claude-haiku-4-5-20251001", max_tokens:500,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type:mt, data:b64 } },
            { type:"text", text:`You are a strict home security AI. Analyze the image and respond ONLY in this JSON format (no markdown):
{"level":"SAFE"|"CAUTION"|"ALERT","message":"situation description in Japanese under 50 chars"}

Strict criteria:
- SAFE: Clearly safe. No people present, or only confirmed family members
- CAUTION: Unfamiliar person, face not visible, unnatural posture or position, hands not visible
- ALERT: Suspected intrusion, multiple suspicious individuals, weapons or tools, touching doors or windows

If uncertain, default to CAUTION. Only use SAFE when absolutely certain.` }
          ]}],
        }),
      });
      const d = await res.json();
      const text = d.content?.find(b => b.type==="text")?.text || "";
      try { return JSON.parse(text.replace(/```json|```/g,"").trim()); }
      catch { return { level:"SAFE", message:"解析完了。特異事項なし。" }; }
    } catch { return { level:"CAUTION", message:"API接続エラー" }; }
    finally { setAnalyzing(false); }
  }, [analyzing]);

  const saveToSupabase = async (result, imgData) => {
    setSaving(true);
    let imagePath = null;
    try {
      if (imgData) {
        const blob = await (await fetch(imgData)).blob();
        const fname = `${userId}/${Date.now()}.jpg`;
        imagePath = await sbUploadImage(blob, fname);
      }
      await sbInsertEvent({
        level: result.level, message: result.message, imagePath,
      });
    } catch (e) { console.error("Supabase save error", e); }
    finally { setSaving(false); }
  };

  captureAndAnalyzeRef.current = async () => {
    const imgData = camActive ? capture() : (captured || uploaded);
    if (!imgData) return;
    const result = await analyzeImage(imgData);
    if (!result) return;
    const entry = { ...result, time: new Date().toLocaleTimeString("ja-JP") };
    setCurLevel(result.level);
    setLogs(p => [entry, ...p].slice(0, 20));
    await saveToSupabase(result, imgData);
  };

  const handleManual = async () => {
    const imgData = captured || uploaded;
    if (!imgData) return;
    const result = await analyzeImage(imgData);
    if (!result) return;
    const entry = { ...result, time: new Date().toLocaleTimeString("ja-JP") };
    setCurLevel(result.level);
    setLogs(p => [entry, ...p].slice(0, 20));
    await saveToSupabase(result, imgData);
  };

  const openGallery = async () => {
    try {
      const evs = await sbFetchEvents(50);
      setDbEvents(evs);
      setGallery(true);
    } catch (e) { alert("取得失敗: " + e.message); }
  };

  const activeImg = captured || uploaded;
  const lv = curLevel ? LEVELS[curLevel] : null;

  return (
    <div style={{
      minHeight:"100vh", background:"#050a05",
      backgroundImage:"radial-gradient(ellipse at 50% 0%,rgba(0,50,20,.4) 0%,transparent 60%)",
      fontFamily:MONO, color:"#00ff88", padding:20, boxSizing:"border-box",
    }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes scanLine{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a100a}::-webkit-scrollbar-thumb{background:#1a4a1a}
      `}</style>

      {/* moving scan */}
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden" }}>
        <div style={{
          position:"absolute",left:0,right:0,height:"25vh",
          background:"linear-gradient(transparent,rgba(0,255,136,0.012),transparent)",
          animation:"scanLine 9s linear infinite",
        }}/>
      </div>

      {gallery && <Gallery events={dbEvents} onClose={() => setGallery(false)}/>}

      <div style={{ maxWidth:960, margin:"0 auto", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:20, paddingBottom:14, borderBottom:"1px solid rgba(0,255,136,0.2)" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:"bold", letterSpacing:4 }}>
              SENTINEL<span style={{ opacity:.4 }}>//AI</span>
            </div>
            <div style={{ fontSize:9, color:"rgba(0,255,136,0.4)", letterSpacing:2, marginTop:2 }}>
              SUPABASE CONNECTED · {time}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <Btn onClick={openGallery} style={{ fontSize:10 }}>☰ 履歴</Btn>
          </div>
        </div>

        {/* Alert bar */}
        {lv && (
          <div style={{
            border:`1px solid ${lv.color}`, background:lv.bg, padding:"8px 14px",
            marginBottom:14, display:"flex", alignItems:"center", gap:10,
            animation:"fadeIn .3s ease",
          }}>
            <span style={{ color:lv.color, fontSize:16,
              animation: curLevel==="ALERT" ? "pulse .7s infinite" : "none" }}>{lv.icon}</span>
            <span style={{ color:lv.color, fontSize:12, fontWeight:"bold", letterSpacing:2 }}>{lv.label}</span>
            {logs[0]?.message && <span style={{ color:"rgba(255,255,255,0.65)", fontSize:11 }}>{logs[0].message}</span>}
            {saving && <span style={{ marginLeft:"auto", fontSize:10, color:"#ffcc00", animation:"pulse 1s infinite" }}>保存中…</span>}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:14 }}>

          {/* Camera panel */}
          <div>
            <div style={{ position:"relative", background:"#000",
              border:"1px solid rgba(0,255,136,0.3)", aspectRatio:"16/10", overflow:"hidden" }}>
              <Scanline/><CRTFrame/>
              <div style={{ position:"absolute", top:10, left:12, zIndex:20,
                fontSize:9, color:"rgba(0,255,136,0.55)", letterSpacing:2 }}>CAM-01 / 玄関</div>

              <video ref={videoRef} muted playsInline style={{
                width:"100%", height:"100%", objectFit:"cover",
                display: camActive ? "block" : "none",
              }}/>

              {activeImg && (
                <img src={activeImg} alt="" style={{
                  position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
                  display: camActive && !captured ? "none" : "block",
                }}/>
              )}

              {!camActive && !activeImg && (
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:8, color:"rgba(0,255,136,0.25)" }}>
                  <div style={{ fontSize:36 }}>⬡</div>
                  <div style={{ fontSize:10, letterSpacing:3 }}>NO SIGNAL</div>
                </div>
              )}

              {(analyzing || saving) && (
                <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  zIndex:30, gap:10 }}>
                  <div style={{ fontSize:10, letterSpacing:4, animation:"pulse 1s infinite" }}>
                    {analyzing ? "AI ANALYZING..." : "SAVING..."}
                  </div>
                </div>
              )}

              {camErr && (
                <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center",
                  fontSize:10, color:"#ffcc00", padding:"0 14px" }}>{camErr}</div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              {!camActive
                ? <Btn onClick={startCam} style={{ flex:1 }}>▶ カメラ起動</Btn>
                : <>
                    <Btn onClick={capture} style={{ flex:1 }}>◉ キャプチャ</Btn>
                    <Btn onClick={stopCam} color="#ff4444">■ 停止</Btn>
                  </>
              }
              <Btn onClick={() => fileRef.current?.click()}>↑ 画像</Btn>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => {
                  const f = e.target.files[0]; if (!f) return;
                  const r = new FileReader();
                  r.onload = ev => { setUploaded(ev.target.result); setCaptured(null); };
                  r.readAsDataURL(f);
                }}/>
              <Btn onClick={handleManual} disabled={!activeImg || analyzing || saving} style={{ flex:2 }}>
                {analyzing ? "解析中..." : saving ? "保存中..." : "⟳ AI解析 + 保存"}
              </Btn>
            </div>

            {/* Auto mode */}
            <div style={{ marginTop:10, padding:"10px 14px",
              border:"1px solid rgba(0,255,136,0.15)", background:"rgba(0,255,136,0.03)" }}>
              <div style={{ fontSize:9, letterSpacing:3, color:"rgba(0,255,136,0.4)", marginBottom:8 }}>
                AUTO MODE {autoOn && <Blink>● REC</Blink>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:11, color:"rgba(0,255,136,0.6)" }}>間隔:</span>
                {[1,2,5,10].map(m => (
                  <button key={m} onClick={() => setAutoMin(m)} style={{
                    fontFamily:MONO, fontSize:10, padding:"4px 10px", cursor:"pointer",
                    background: autoMin===m ? "rgba(0,255,136,0.15)" : "transparent",
                    border: `1px solid ${autoMin===m ? "#00ff88" : "rgba(0,255,136,0.3)"}`,
                    color: autoMin===m ? "#00ff88" : "rgba(0,255,136,0.5)",
                  }}>{m}分</button>
                ))}
                <Btn onClick={() => setAutoOn(v => !v)} disabled={!camActive}
                  color={autoOn ? "#ff4444" : "#00ff88"} style={{ marginLeft:"auto" }}>
                  {autoOn ? "■ 停止" : "▶ 開始"}
                </Btn>
              </div>
              {!camActive && <div style={{ fontSize:10, color:"rgba(255,204,0,0.5)", marginTop:6 }}>
                ※ カメラ起動後に使用可能
              </div>}
            </div>
          </div>

          {/* Log panel */}
          <div style={{ border:"1px solid rgba(0,255,136,0.2)", background:"rgba(0,8,0,0.6)",
            display:"flex", flexDirection:"column", maxHeight:480 }}>
            <div style={{ padding:"9px 12px", borderBottom:"1px solid rgba(0,255,136,0.15)",
              fontSize:9, letterSpacing:3, color:"rgba(0,255,136,0.45)",
              display:"flex", justifyContent:"space-between" }}>
              <span>LIVE LOG</span><span>{logs.length} EVENTS</span>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
              {logs.length === 0
                ? <div style={{ color:"rgba(0,255,136,0.2)", fontSize:10, textAlign:"center", marginTop:30, letterSpacing:2 }}>
                    NO EVENTS
                  </div>
                : logs.map((l, i) => {
                    const lv = LEVELS[l.level] || LEVELS.SAFE;
                    return (
                      <div key={i} style={{ borderLeft:`2px solid ${lv.color}`, paddingLeft:8,
                        marginBottom:10, animation:`fadeIn .3s ease ${i*.04}s both` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ color:lv.color, fontSize:9, fontWeight:"bold" }}>{lv.icon} {lv.label}</span>
                          <span style={{ color:"#555", fontSize:9 }}>{l.time}</span>
                        </div>
                        <div style={{ color:"#bbb", fontSize:11, lineHeight:1.5 }}>{l.message}</div>
                      </div>
                    );
                  })
              }
            </div>
            {logs.length > 0 && (
              <div style={{ padding:"7px 12px", borderTop:"1px solid rgba(0,255,136,0.1)" }}>
                <Btn onClick={() => { setLogs([]); setCurLevel(null); }} color="rgba(255,68,68,0.6)"
                  style={{ width:"100%", fontSize:10 }}>✕ クリア</Btn>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop:16, paddingTop:10, borderTop:"1px solid rgba(0,255,136,0.1)",
          display:"flex", justifyContent:"space-between", fontSize:9, color:"rgba(0,255,136,0.25)", letterSpacing:2 }}>
          <span>CLAUDE VISION + SUPABASE</span>
          <span>SENTINEL HOME SECURITY</span>
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail]   = useState("");
  const [sent,  setSent]    = useState(false);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#050a05",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: MONO, color: "#00ff88",
    }}>
      <div style={{
        border: "1px solid rgba(0,255,136,0.3)", padding: 40, width: 320,
        background: "rgba(0,8,0,0.6)",
      }}>
        <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 4, marginBottom: 8 }}>
          SENTINEL<span style={{ opacity: .4 }}>//AI</span>
        </div>
        <div style={{ fontSize: 9, color: "rgba(0,255,136,0.4)", letterSpacing: 2, marginBottom: 32 }}>
          AUTHENTICATION REQUIRED
        </div>

        {sent ? (
          <div style={{ fontSize: 12, color: "#00ff88", lineHeight: 1.8 }}>
            メールを送信しました。<br/>
            リンクをクリックしてログインしてください。
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="メールアドレス" required
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 12,
                background: "transparent", border: "1px solid rgba(0,255,136,0.3)",
                color: "#00ff88", fontFamily: MONO, fontSize: 12,
                boxSizing: "border-box", outline: "none",
              }}
            />
            {error && <div style={{ fontSize: 10, color: "#ff4444", marginBottom: 8 }}>{error}</div>}
            <Btn style={{ width: "100%" }} disabled={loading}>
              {loading ? "送信中..." : "▶ Magic Linkを送信"}
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return session ? <Monitor session={session} /> : <Login />;
}