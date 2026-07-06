"use strict";
/* ============================================================
   saas-shell.jsx — multi-tenant layer for คลินิกเวชกรรมแพทย์ณัฐดนัย
   Loaded AFTER React/ReactDOM/supabase-js, BEFORE clinic-dashboard.js.
   Exposes window.SaaSRootRouter (mounted by index.html's boot script)
   and window.__sb / window.__TENANT__ (read by clinic-dashboard.js's
   supa helper for tenant-scoped requests).
   ============================================================ */
(function () {
    const SUPABASE_URL = "https://lozyfwydyrovxjtsgybn.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_jI3JybKun8lwaokt8HT8lA_FMy3WfOi";
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    function withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error((label || "การเชื่อมต่อ") + "หมดเวลา — ตรวจสอบอินเทอร์เน็ตหรือสถานะ Supabase (โปรเจกต์อาจถูกพักไว้)")), ms)),
        ]);
    }
    window.__sb = sb;
    window.__TENANT__ = { clinicId: null, accessToken: null };
    const PDPA_VERSION = "1.0";
    const h = React.createElement;
    const COLORS = { primary: "#1a5276", primaryDark: "#154360", bg: "#f0f4f8", danger: "#e74c3c" };
    const btnStyle = {
        background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8,
        padding: "12px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%",
    };
    const inputStyle = {
        width: "100%", padding: "11px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
        fontSize: 15, marginBottom: 12, fontFamily: "'Sarabun', sans-serif",
    };
    const cardStyle = {
        background: "#fff", borderRadius: 14, padding: "28px 26px", maxWidth: 420, width: "calc(100% - 40px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    };
    const shellWrap = {
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(160deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
        fontFamily: "'Sarabun', sans-serif", padding: 20,
    };
    function ErrBox({ msg }) {
        if (!msg)
            return null;
        return h("div", { style: { background: "#fdecea", color: "#c0392b", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 } }, msg);
    }
    function BootScreen({ label }) {
        return h("div", { style: shellWrap }, h("div", { style: { textAlign: "center", color: "#fff" } }, h("div", { style: { fontSize: 56, marginBottom: 12 } }, "🏥"), h("div", { style: { fontWeight: 700, fontSize: 18 } }, "คลินิกเวชกรรมแพทย์ณัฐดนัย"), h("div", { style: { fontSize: 13, opacity: 0.75, marginTop: 6 } }, label || "กำลังโหลดระบบ...")));
    }
    // ---------------- Auth (login / registration: policy+subscription -> register / staff join via deep link) ----------------
    const backLinkStyle = { color: "#7f8c8d", fontSize: 13, cursor: "pointer", textDecoration: "underline" };
    const noticeStyle = { background: "#eafaf1", color: "#1e8449", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 };
    function AuthScreen({ onAuthed, resumeSession, joinCode: joinCodeFromUrl }) {
        const [screen, setScreen] = React.useState(joinCodeFromUrl ? "join" : (resumeSession ? "register" : "landing"));
        const [plans, setPlans] = React.useState([]);
        const [selectedPlan, setSelectedPlan] = React.useState(null);
        const [agree, setAgree] = React.useState(false);
        const [email, setEmail] = React.useState(resumeSession ? resumeSession.user.email : "");
        const [password, setPassword] = React.useState("");
        const [fullName, setFullName] = React.useState("");
        const [clinicName, setClinicName] = React.useState("");
        const [licenseNumber, setLicenseNumber] = React.useState("");
        const [address, setAddress] = React.useState("");
        const [phone, setPhone] = React.useState("");
        const [joinCode, setJoinCode] = React.useState(joinCodeFromUrl || "");
        const [notice, setNotice] = React.useState(resumeSession ? "ยืนยันอีเมลแล้ว กรุณากรอกข้อมูลด้านล่างเพื่อเริ่มใช้งาน" : "");
        const [err, setErr] = React.useState("");
        const [busy, setBusy] = React.useState(false);
        React.useEffect(() => {
            if (screen === "plan" && plans.length === 0) {
                sb.from("plans").select("*").order("price_thb").then(({ data }) => setPlans(data || []));
            }
        }, [screen]);
        async function doLogin() {
            setBusy(true);
            setErr("");
            try {
                const loginEmail = email.trim().toLowerCase() === "superadmin" ? "superadmin@knemr.local" : email.trim();
                const { error } = await withTimeout(sb.auth.signInWithPassword({ email: loginEmail, password }), 10000, "เข้าสู่ระบบ");
                if (error)
                    throw error;
                onAuthed();
            }
            catch (e) {
                setErr(e.message || String(e));
            }
            finally {
                setBusy(false);
            }
        }
        async function doRegister() {
            if (!selectedPlan) {
                setErr("กรุณาเลือกแผนการใช้งาน");
                setScreen("plan");
                return;
            }
            if (!agree) {
                setErr("กรุณายอมรับเงื่อนไขการใช้บริการก่อนดำเนินการต่อ");
                setScreen("plan");
                return;
            }
            setBusy(true);
            setErr("");
            try {
                let uid;
                if (resumeSession) {
                    uid = resumeSession.user.id;
                }
                else {
                    const { data: su, error: e1 } = await sb.auth.signUp({ email, password });
                    if (e1)
                        throw e1;
                    uid = su.user && su.user.id;
                    if (!su.session) {
                        setNotice("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
                        setScreen("landing");
                        return;
                    }
                }
                const slug = clinicName.toLowerCase().trim().replace(/[^a-z0-9ก-๙-]+/g, "-").replace(/(^-|-$)/g, "") || ("clinic-" + Date.now());
                const { data: clinic, error: e2 } = await sb.from("clinics").insert({
                    name: clinicName, slug, status: "pending", address, phone,
                }).select().single();
                if (e2)
                    throw e2;
                const { error: e3 } = await sb.from("profiles").insert({
                    id: uid, clinic_id: clinic.id, full_name: fullName, role: "doctor", status: "pending",
                    medical_license_number: licenseNumber, email,
                });
                if (e3)
                    throw e3;
                const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString();
                const { error: e4 } = await sb.from("clinic_subscriptions").insert({
                    clinic_id: clinic.id, plan_id: selectedPlan, status: "trialing", trial_ends_at: trialEnds, current_period_end: trialEnds,
                });
                if (e4)
                    throw e4;
                onAuthed();
            }
            catch (e) {
                setErr(e.message || String(e));
            }
            finally {
                setBusy(false);
            }
        }
        async function doJoin() {
            setBusy(true);
            setErr("");
            try {
                const { data: clinic, error: ce } = await sb.from("clinics").select("id").eq("slug", joinCode.trim().toLowerCase()).maybeSingle();
                if (ce)
                    throw ce;
                if (!clinic)
                    throw new Error("ไม่พบรหัสคลินิกนี้");
                let uid;
                if (resumeSession) {
                    uid = resumeSession.user.id;
                }
                else {
                    const { data: su, error: e1 } = await sb.auth.signUp({ email, password });
                    if (e1)
                        throw e1;
                    uid = su.user && su.user.id;
                    if (!su.session) {
                        setNotice("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
                        setScreen("login");
                        return;
                    }
                }
                const { error: e2 } = await sb.from("profiles").insert({ id: uid, clinic_id: clinic.id, full_name: fullName, role: "staff", status: "pending" });
                if (e2)
                    throw e2;
                setNotice("ลงทะเบียนสำเร็จ กรุณารอแพทย์อนุมัติบัญชีของท่าน");
                setScreen("login");
            }
            catch (e) {
                setErr(e.message || String(e));
            }
            finally {
                setBusy(false);
            }
        }
        // ---- landing: exactly two options, per spec ----
        if (screen === "landing") {
            return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontSize: 40, textAlign: "center", marginBottom: 4 } }, "🏥"), h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 26, color: "#1a5276" } }, "คลินิกเวชกรรมแพทย์ณัฐดนัย"), h(ErrBox, { msg: err }), h("button", { style: { ...btnStyle, marginBottom: 12 }, onClick: () => { setErr(""); setScreen("login"); } }, "เข้าสู่ระบบ"), h("button", {
                style: { ...btnStyle, background: "#fff", color: COLORS.primary, border: `1px solid ${COLORS.primary}` },
                onClick: () => { setErr(""); setScreen("plan"); },
            }, "ลงทะเบียนคลินิกใหม่")));
        }
        // ---- login ----
        if (screen === "login") {
            return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontSize: 40, textAlign: "center", marginBottom: 4 } }, "🏥"), h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 18, color: "#1a5276" } }, "เข้าสู่ระบบ"), notice && h("div", { style: noticeStyle }, notice), h(ErrBox, { msg: err }), h("input", { style: inputStyle, type: "email", placeholder: "อีเมล", value: email, onChange: e => setEmail(e.target.value) }), h("input", { style: inputStyle, type: "password", placeholder: "รหัสผ่าน", value: password, onChange: e => setPassword(e.target.value) }), h("button", { style: { ...btnStyle, opacity: busy ? 0.6 : 1 }, disabled: busy, onClick: doLogin }, busy ? "กำลังดำเนินการ..." : "เข้าสู่ระบบ"), h("div", { style: { textAlign: "center", marginTop: 14 } }, h("span", { style: backLinkStyle, onClick: () => { setErr(""); setScreen("landing"); } }, "← กลับ"))));
        }
        // ---- policy & subscription (plan select) ----
        if (screen === "plan") {
            return h("div", { style: shellWrap }, h("div", { style: { ...cardStyle, maxWidth: 460 } }, h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 4, color: "#1a5276" } }, "แผนการใช้งานและเงื่อนไขบริการ"), h("div", { style: { fontSize: 12.5, textAlign: "center", color: "#7f8c8d", marginBottom: 16 } }, "เลือกแผนที่ต้องการก่อนลงทะเบียนคลินิก"), h(ErrBox, { msg: err }), h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 } }, plans.length === 0 ? h("div", { style: { fontSize: 13, color: "#999" } }, "กำลังโหลดแผน...") :
                plans.map(p => {
                    var _a, _b;
                    return h("div", {
                        key: p.id, onClick: () => setSelectedPlan(p.id),
                        style: {
                            border: `2px solid ${selectedPlan === p.id ? COLORS.primary : "#e2e8f0"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                            background: selectedPlan === p.id ? "#eaf2f8" : "#fff",
                        },
                    }, h("div", { style: { fontWeight: 700, fontSize: 14.5 } }, p.name), h("div", { style: { fontSize: 13, color: "#666", marginTop: 2 } }, "฿" + p.price_thb + "/เดือน"), h("div", { style: { fontSize: 12, color: "#999", marginTop: 2 } }, "staff ≤ " + ((_a = p.max_staff) !== null && _a !== void 0 ? _a : "ไม่จำกัด") + " · patients ≤ " + ((_b = p.max_patients) !== null && _b !== void 0 ? _b : "ไม่จำกัด")));
                })), h("label", { style: { display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0 18px", fontSize: 13 } }, h("input", { type: "checkbox", checked: agree, onChange: e => setAgree(e.target.checked), style: { marginTop: 3 } }), "ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขการให้บริการและนโยบายความเป็นส่วนตัวของระบบ"), h("button", {
                style: { ...btnStyle, opacity: (!selectedPlan || !agree) ? 0.5 : 1 }, disabled: !selectedPlan || !agree,
                onClick: () => { setErr(""); setScreen("register"); },
            }, "ดำเนินการต่อ"), h("div", { style: { textAlign: "center", marginTop: 14 } }, h("span", { style: backLinkStyle, onClick: () => { setErr(""); setScreen("landing"); } }, "← กลับ"))));
        }
        // ---- registration form (new clinic + owner account) ----
        if (screen === "register") {
            const planName = plans.find(p => p.id === selectedPlan);
            return h("div", { style: shellWrap }, h("div", { style: { ...cardStyle, maxWidth: 460 } }, h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 4, color: "#1a5276" } }, "ลงทะเบียนคลินิกใหม่"), planName && h("div", { style: { fontSize: 12.5, textAlign: "center", color: "#7f8c8d", marginBottom: 16 } }, "แผนที่เลือก: " + planName.name), notice && h("div", { style: noticeStyle }, notice), h(ErrBox, { msg: err }), h("input", { style: inputStyle, type: "email", placeholder: "อีเมล", value: email, onChange: e => setEmail(e.target.value) }), h("input", { style: inputStyle, type: "password", placeholder: "รหัสผ่าน", value: password, onChange: e => setPassword(e.target.value) }), h("input", { style: inputStyle, placeholder: "ชื่อ-นามสกุล", value: fullName, onChange: e => setFullName(e.target.value) }), h("input", { style: inputStyle, placeholder: "ชื่อคลินิก", value: clinicName, onChange: e => setClinicName(e.target.value) }), h("input", { style: inputStyle, placeholder: "เลขที่ใบอนุญาตประกอบวิชาชีพเวชกรรม", value: licenseNumber, onChange: e => setLicenseNumber(e.target.value) }), h("input", { style: inputStyle, placeholder: "ที่อยู่คลินิก", value: address, onChange: e => setAddress(e.target.value) }), h("input", { style: inputStyle, placeholder: "เบอร์โทรศัพท์", value: phone, onChange: e => setPhone(e.target.value) }), h("button", { style: { ...btnStyle, opacity: busy ? 0.6 : 1 }, disabled: busy, onClick: doRegister }, busy ? "กำลังส่งข้อมูล..." : "ลงทะเบียน"), h("div", { style: { textAlign: "center", marginTop: 14 } }, h("span", { style: backLinkStyle, onClick: () => { setErr(""); setScreen("plan"); } }, "← กลับไปเลือกแผน"))));
        }
        // ---- staff joining an existing clinic — reachable only via ?join=<code> deep link shared by the clinic owner, not shown on the main screen ----
        return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontSize: 40, textAlign: "center", marginBottom: 4 } }, "🏥"), h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 18, color: "#1a5276" } }, "เข้าร่วมคลินิก"), notice && h("div", { style: noticeStyle }, notice), h(ErrBox, { msg: err }), h("input", { style: inputStyle, placeholder: "ชื่อ-นามสกุล", value: fullName, onChange: e => setFullName(e.target.value) }), !joinCodeFromUrl && h("input", { style: inputStyle, placeholder: "รหัสคลินิก (จากแพทย์)", value: joinCode, onChange: e => setJoinCode(e.target.value) }), h("input", { style: inputStyle, type: "email", placeholder: "อีเมล", value: email, onChange: e => setEmail(e.target.value) }), h("input", { style: inputStyle, type: "password", placeholder: "รหัสผ่าน", value: password, onChange: e => setPassword(e.target.value) }), h("button", { style: { ...btnStyle, opacity: busy ? 0.6 : 1 }, disabled: busy, onClick: doJoin }, busy ? "กำลังดำเนินการ..." : "ลงทะเบียนเข้าร่วม"), h("div", { style: { textAlign: "center", marginTop: 14 } }, h("span", { style: backLinkStyle, onClick: () => { setErr(""); setScreen("login"); } }, "← กลับไปหน้าเข้าสู่ระบบ"))));
    }
    // ---------------- PDPA ----------------
    const PDPA_TEXT = [
        "คลินิกฯ เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่านเพื่อการให้บริการทางการแพทย์ การนัดหมาย การเงิน และการปฏิบัติตามกฎหมาย",
        "ท่านมีสิทธิขอเข้าถึง แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลของท่านตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
        "การกดยอมรับถือว่าท่านรับทราบและยินยอมให้ระบบจัดเก็บข้อมูลดังกล่าวสำหรับการใช้งานระบบคลินิก",
    ];
    function PDPAModal({ onAccept }) {
        const [checked, setChecked] = React.useState(false);
        const [busy, setBusy] = React.useState(false);
        return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontWeight: 700, fontSize: 17, marginBottom: 12 } }, "ความยินยอมการใช้ข้อมูลส่วนบุคคล (PDPA)"), PDPA_TEXT.map((t, i) => h("p", { key: i, style: { fontSize: 13.5, lineHeight: 1.7, marginBottom: 10, color: "#333" } }, t)), h("label", { style: { display: "flex", alignItems: "flex-start", gap: 8, margin: "14px 0", fontSize: 13.5 } }, h("input", { type: "checkbox", checked, onChange: e => setChecked(e.target.checked), style: { marginTop: 3 } }), "ข้าพเจ้าได้อ่านและยินยอมตามข้อตกลงข้างต้น"), h("button", {
            style: { ...btnStyle, opacity: (!checked || busy) ? 0.5 : 1 }, disabled: !checked || busy,
            onClick: async () => { setBusy(true); await onAccept(); setBusy(false); },
        }, busy ? "กำลังบันทึก..." : "ยอมรับและดำเนินการต่อ")));
    }
    // ---------------- Gate screens ----------------
    function GateScreen({ title, body, showSignOut }) {
        return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontWeight: 700, fontSize: 17, marginBottom: 10, color: COLORS.danger } }, title), h("p", { style: { fontSize: 14, lineHeight: 1.7, color: "#333", marginBottom: 16 } }, body), showSignOut && h("button", { style: btnStyle, onClick: () => sb.auth.signOut().then(() => window.location.reload()) }, "ออกจากระบบ")));
    }
    // ---------------- Email link confirmation ----------------
    // Handles ?token_hash=&type= links (see custom email templates). Requires an explicit
    // tap before calling verifyOtp, and never lets Supabase's own /auth/v1/verify GET
    // endpoint see the token at all — both defend against Outlook/Mimecast "Safe Links"
    // style scanners that pre-fetch email links and silently burn the one-time token.
    function ConfirmScreen({ tokenHash, type, onDone }) {
        const [busy, setBusy] = React.useState(false);
        const [err, setErr] = React.useState("");
        async function confirm() {
            setBusy(true);
            setErr("");
            try {
                const { data, error } = await withTimeout(sb.auth.verifyOtp({ token_hash: tokenHash, type }), 10000, "ยืนยันอีเมล");
                if (error)
                    throw error;
                window.history.replaceState({}, document.title, window.location.pathname);
                onDone(data.session);
            }
            catch (e) {
                setErr((e.message || String(e)) + " — ลิงก์นี้อาจถูกใช้ไปแล้ว (เช่น ถูกระบบสแกนอีเมลเปิดล่วงหน้า) หรือหมดอายุ กรุณาขอลิงก์ใหม่แล้วกดยืนยันทันที หรือให้ผู้ดูแลระบบยืนยันบัญชีให้จาก Supabase Dashboard โดยตรง");
                setBusy(false);
            }
        }
        return h("div", { style: shellWrap }, h("div", { style: cardStyle }, h("div", { style: { fontSize: 40, textAlign: "center", marginBottom: 4 } }, "📧"), h("div", { style: { fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 12, color: "#1a5276" } }, "ยืนยันอีเมลของคุณ"), h("p", { style: { fontSize: 13.5, color: "#555", textAlign: "center", marginBottom: 16 } }, "กดปุ่มด้านล่างเพื่อยืนยันตัวตนและเข้าสู่ระบบ (ต้องกดด้วยตนเองเพื่อป้องกันลิงก์ถูกใช้โดยระบบสแกนอีเมลอัตโนมัติ)"), h(ErrBox, { msg: err }), h("button", { style: { ...btnStyle, opacity: busy ? 0.6 : 1 }, disabled: busy, onClick: confirm }, busy ? "กำลังยืนยัน..." : "ยืนยันและเข้าสู่ระบบ")));
    }
    // ---------------- Super Admin portal ----------------
    function SuperAdminPortal() {
        const [tab, setTab] = React.useState("pending");
        const [clinics, setClinics] = React.useState([]);
        const [subs, setSubs] = React.useState([]);
        const [plans, setPlans] = React.useState([]);
        const [owners, setOwners] = React.useState([]);
        const [loading, setLoading] = React.useState(true);
        const [openClinic, setOpenClinic] = React.useState(null); // clinic row currently opened for support, or null
        const prevTenant = React.useRef(null);
        async function loadAll() {
            setLoading(true);
            const [c, s, p, o] = await Promise.all([
                sb.from("clinics").select("*").order("created_at", { ascending: false }),
                sb.from("clinic_subscriptions").select("*, plans(name,code)"),
                sb.from("plans").select("*").order("price_thb"),
                sb.from("profiles").select("*").eq("role", "doctor"),
            ]);
            setClinics(c.data || []);
            setSubs(s.data || []);
            setPlans(p.data || []);
            setOwners(o.data || []);
            setLoading(false);
        }
        React.useEffect(() => { loadAll(); }, []);
        async function toggleClinicStatus(clinic) {
            const next = clinic.status === "active" ? "suspended" : "active";
            await sb.from("clinics").update({ status: next }).eq("id", clinic.id);
            loadAll();
        }
        async function setSubStatus(clinicId, status) {
            await sb.from("clinic_subscriptions").update({ status }).eq("clinic_id", clinicId);
            loadAll();
        }
        const subFor = (clinicId) => subs.find(s => s.clinic_id === clinicId);
        const ownerFor = (clinicId) => owners.find(o => o.clinic_id === clinicId);
        // Approve: activates the clinic + its owner account, and makes sure a subscription
        // row exists for the plan they picked at registration (normally already created then;
        // this is just a defensive fallback so "approve" always finishes workspace setup).
        async function approveClinic(clinic) {
            await sb.from("clinics").update({ status: "active" }).eq("id", clinic.id);
            const owner = ownerFor(clinic.id);
            if (owner)
                await sb.from("profiles").update({ status: "approved" }).eq("id", owner.id);
            if (!subFor(clinic.id)) {
                const { data: trialPlan } = await sb.from("plans").select("id").eq("code", "trial").maybeSingle();
                if (trialPlan) {
                    const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString();
                    await sb.from("clinic_subscriptions").insert({ clinic_id: clinic.id, plan_id: trialPlan.id, status: "trialing", trial_ends_at: trialEnds, current_period_end: trialEnds });
                }
            }
            loadAll();
        }
        async function rejectClinic(clinic) {
            if (!window.confirm("ยืนยันปฏิเสธคำขอลงทะเบียนคลินิกนี้?"))
                return;
            await sb.from("clinics").update({ status: "rejected" }).eq("id", clinic.id);
            const owner = ownerFor(clinic.id);
            if (owner)
                await sb.from("profiles").update({ status: "rejected" }).eq("id", owner.id);
            loadAll();
        }
        // Open a clinic's own dashboard for management/support, then return to Super Admin.
        function openClinicDashboard(clinic) {
            prevTenant.current = { clinicId: window.__TENANT__.clinicId, accessToken: window.__TENANT__.accessToken };
            window.__TENANT__.clinicId = clinic.id;
            try {
                localStorage.setItem("clinic_session_v1", JSON.stringify({
                    id: "super-admin", name: "Super Admin (สนับสนุน)", username: "superadmin",
                    role: "doctor", status: "active",
                }));
            }
            catch (_) { }
            setOpenClinic(clinic);
        }
        function backToAdmin() {
            if (prevTenant.current) {
                window.__TENANT__.clinicId = prevTenant.current.clinicId;
                window.__TENANT__.accessToken = prevTenant.current.accessToken;
            }
            try {
                localStorage.removeItem("clinic_session_v1");
            }
            catch (_) { }
            setOpenClinic(null);
        }
        if (openClinic) {
            return h("div", null, h("div", { style: { background: COLORS.primaryDark, color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 } }, h("div", null, "🛠 กำลังดูในฐานะ Super Admin: ", h("b", null, openClinic.name)), h("button", { onClick: backToAdmin, style: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 13 } }, "← กลับสู่ Super Admin")), h(window.AppRoot));
        }
        const pendingClinics = clinics.filter(c => c.status === "pending");
        return h("div", { style: { minHeight: "100vh", background: COLORS.bg, fontFamily: "'Sarabun', sans-serif" } }, h("div", { style: { background: COLORS.primary, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" } }, h("div", { style: { fontWeight: 700 } }, "🛠 Super Admin"), h("button", { onClick: () => sb.auth.signOut().then(() => window.location.reload()), style: { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 6, padding: "6px 12px", cursor: "pointer" } }, "ออกจากระบบ")), h("div", { style: { display: "flex", gap: 8, padding: "14px 20px" } }, ["pending", "clinics", "plans"].map(k => h("button", {
            key: k, onClick: () => setTab(k),
            style: { padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", cursor: "pointer", position: "relative",
                background: tab === k ? COLORS.primary : "#fff", color: tab === k ? "#fff" : "#333" }
        }, k === "pending" ? `รออนุมัติ${pendingClinics.length ? " (" + pendingClinics.length + ")" : ""}` : k === "clinics" ? "คลินิกทั้งหมด" : "แผนราคา"))), loading ? h("div", { style: { padding: 20 } }, "กำลังโหลด...") :
            tab === "pending" ? h("div", { style: { padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 } }, pendingClinics.length === 0 ? h("div", { style: { color: "#999", fontSize: 13.5 } }, "ไม่มีคำขอลงทะเบียนที่รออนุมัติ") :
                pendingClinics.map(c => {
                    const owner = ownerFor(c.id);
                    const s = subFor(c.id);
                    return h("div", { key: c.id, style: { background: "#fff", borderRadius: 10, padding: 16 } }, h("div", { style: { fontWeight: 700, fontSize: 15 } }, c.name), h("div", { style: { fontSize: 13, color: "#555", marginTop: 6, lineHeight: 1.7 } }, "ผู้ลงทะเบียน: " + (owner ? owner.full_name : "-") + (owner && owner.email ? " · " + owner.email : ""), h("br"), "เลขที่ใบอนุญาต: " + (owner && owner.medical_license_number ? owner.medical_license_number : "-"), h("br"), "ที่อยู่: " + (c.address || "-"), h("br"), "โทร: " + (c.phone || "-"), h("br"), "แผนที่เลือก: " + (s && s.plans ? s.plans.name : "-")), h("div", { style: { display: "flex", gap: 8, marginTop: 12 } }, h("button", { onClick: () => approveClinic(c), style: { flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "#1e8449", color: "#fff", fontWeight: 600 } }, "✓ อนุมัติ"), h("button", { onClick: () => rejectClinic(c), style: { flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "#c0392b", color: "#fff", fontWeight: 600 } }, "✕ ปฏิเสธ")));
                })) :
                tab === "clinics" ? h("div", { style: { padding: "0 20px 20px" } }, h("table", { style: { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 10, overflow: "hidden" } }, h("thead", null, h("tr", { style: { background: "#e2e8f0", textAlign: "left" } }, ["ชื่อคลินิก", "สถานะคลินิก", "แผน", "สถานะสมัครสมาชิก", ""].map((c, i) => h("th", { key: i, style: { padding: 10, fontSize: 13 } }, c)))), h("tbody", null, clinics.map(c => {
                    const s = subFor(c.id);
                    return h("tr", { key: c.id, style: { borderTop: "1px solid #eee" } }, h("td", { style: { padding: 10, fontSize: 13.5 } }, c.name), h("td", { style: { padding: 10, fontSize: 13.5, color: c.status === "active" ? "#1e8449" : c.status === "pending" ? "#b7791f" : "#c0392b" } }, c.status), h("td", { style: { padding: 10, fontSize: 13.5 } }, s ? (s.plans ? s.plans.name : s.plan_id) : "-"), h("td", { style: { padding: 10, fontSize: 13.5 } }, s ? h("select", {
                        value: s.status, onChange: e => setSubStatus(c.id, e.target.value),
                        style: { fontSize: 13 }
                    }, ["trialing", "active", "past_due", "expired", "cancelled"].map(v => h("option", { key: v, value: v }, v))) : "-"), h("td", { style: { padding: 10, display: "flex", gap: 6 } }, c.status !== "pending" && h("button", {
                        onClick: () => toggleClinicStatus(c),
                        style: { fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer",
                            background: c.status === "active" ? "#fdecea" : "#eafaf1", color: c.status === "active" ? "#c0392b" : "#1e8449" }
                    }, c.status === "active" ? "ระงับ" : "เปิดใช้งาน"), c.status === "active" && h("button", {
                        onClick: () => openClinicDashboard(c),
                        style: { fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer", background: "#fff", color: COLORS.primary }
                    }, "เปิดแดชบอร์ด")));
                })))) :
                    h("div", { style: { padding: "0 20px 20px", display: "flex", gap: 14, flexWrap: "wrap" } }, plans.map(p => {
                        var _a, _b;
                        return h("div", { key: p.id, style: { background: "#fff", borderRadius: 10, padding: 16, minWidth: 180 } }, h("div", { style: { fontWeight: 700 } }, p.name), h("div", { style: { fontSize: 13, color: "#666", marginTop: 4 } }, "฿" + p.price_thb + "/เดือน"), h("div", { style: { fontSize: 12.5, color: "#999", marginTop: 4 } }, "staff ≤ " + ((_a = p.max_staff) !== null && _a !== void 0 ? _a : "ไม่จำกัด") + " · patients ≤ " + ((_b = p.max_patients) !== null && _b !== void 0 ? _b : "ไม่จำกัด")));
                    })));
    }
    // ---------------- Root router ----------------
    function RootRouter() {
        const [state, setState] = React.useState({ phase: "loading" });
        // Captured once on first mount: if the URL carries ?token_hash=&type= (our custom
        // email-template link), show a manual confirm step instead of letting getSession()
        // race ahead and briefly bounce to the login screen.
        const [pendingConfirm] = React.useState(() => {
            const p = new URLSearchParams(window.location.search);
            const token_hash = p.get("token_hash");
            const type = p.get("type");
            return token_hash && type ? { token_hash, type } : null;
        });
        // Staff join-clinic deep link (?join=<clinic-slug>), shared by a clinic owner —
        // deliberately not exposed as an option on the main login screen.
        const [joinCodeFromUrl] = React.useState(() => new URLSearchParams(window.location.search).get("join") || "");
        async function loadAll(session) {
            try {
                const { data: profile, error: pErr } = await withTimeout(sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle(), 10000, "โหลดโปรไฟล์");
                if (pErr)
                    throw pErr;
                if (!profile) {
                    setState({ phase: "auth", resumeSession: session });
                    return;
                }
                window.__TENANT__.clinicId = profile.clinic_id;
                window.__TENANT__.accessToken = session.access_token;
                if (profile.role === "super_admin") {
                    setState({ phase: "super-admin" });
                    return;
                }
                if (profile.status === "rejected") {
                    setState({ phase: "rejected", role: profile.role });
                    return;
                }
                if (profile.status === "pending") {
                    setState({ phase: "pending", role: profile.role });
                    return;
                }
                if (profile.status === "suspended") {
                    setState({ phase: "user-suspended" });
                    return;
                }
                const { data: clinic } = await sb.from("clinics").select("*").eq("id", profile.clinic_id).maybeSingle();
                if (clinic && clinic.status === "rejected") {
                    setState({ phase: "rejected", role: profile.role });
                    return;
                }
                if (clinic && clinic.status === "pending") {
                    setState({ phase: "pending", role: profile.role });
                    return;
                }
                if (clinic && clinic.status === "suspended") {
                    setState({ phase: "clinic-suspended" });
                    return;
                }
                if (!profile.pdpa_consented_at) {
                    setState({ phase: "pdpa", profile });
                    return;
                }
                const { data: subscription } = await sb.from("clinic_subscriptions").select("*").eq("clinic_id", profile.clinic_id).maybeSingle();
                if (subscription && ["expired", "cancelled"].includes(subscription.status)) {
                    setState({ phase: "billing", subscription });
                    return;
                }
                // Bridge into the existing localStorage-based session the dashboard already expects —
                // this lets clinic-dashboard.jsx/AppRoot mount completely unchanged.
                try {
                    localStorage.setItem("clinic_session_v1", JSON.stringify({
                        id: profile.id, name: profile.full_name || session.user.email, username: session.user.email,
                        role: profile.role === "doctor" ? "doctor" : profile.role === "nurse" ? "nurse" : "staff",
                        status: "active",
                    }));
                }
                catch (_) { }
                setState({ phase: "app" });
            }
            catch (e) {
                console.error("[saas-shell] loadAll failed:", e);
                setState({ phase: "load-error", message: e.message || String(e) });
            }
        }
        React.useEffect(() => {
            if (pendingConfirm) {
                setState({ phase: "confirm" });
            }
            else {
                withTimeout(sb.auth.getSession(), 10000, "โหลดเซสชัน")
                    .then(({ data }) => { if (data.session)
                    loadAll(data.session);
                else
                    setState({ phase: "auth" }); })
                    .catch(e => { console.error("[saas-shell] getSession failed:", e); setState({ phase: "load-error", message: e.message || String(e) }); });
            }
            const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
                if (session)
                    loadAll(session);
                else if (!pendingConfirm) {
                    try {
                        localStorage.removeItem("clinic_session_v1");
                    }
                    catch (_) { }
                    setState({ phase: "auth" });
                }
            });
            return () => sub.subscription.unsubscribe();
        }, []);
        async function acceptPDPA() {
            const { data } = await sb.auth.getSession();
            const uid = data.session.user.id;
            await sb.from("profiles").update({ pdpa_consented_at: new Date().toISOString(), pdpa_version: PDPA_VERSION }).eq("id", uid);
            await sb.from("consent_records").insert({ profile_id: uid, clinic_id: state.profile.clinic_id, pdpa_version: PDPA_VERSION, user_agent: navigator.userAgent });
            loadAll(data.session);
        }
        switch (state.phase) {
            case "loading": return h(BootScreen, {});
            case "confirm": return h(ConfirmScreen, { tokenHash: pendingConfirm.token_hash, type: pendingConfirm.type, onDone: (session) => (session ? loadAll(session) : setState({ phase: "auth" })) });
            case "auth": return h(AuthScreen, { onAuthed: () => sb.auth.getSession().then(({ data }) => loadAll(data.session)), resumeSession: state.resumeSession || null, joinCode: joinCodeFromUrl });
            case "pending": return h(GateScreen, {
                title: "รอการอนุมัติ",
                body: state.role === "doctor"
                    ? "ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากผู้ดูแลระบบ (Super Admin) ก่อนเข้าใช้งาน"
                    : "บัญชีของท่านลงทะเบียนสำเร็จแล้ว กรุณารอแพทย์ประจำคลินิกอนุมัติก่อนเข้าใช้งาน",
                showSignOut: true,
            });
            case "rejected": return h(GateScreen, {
                title: "ไม่ผ่านการอนุมัติ",
                body: state.role === "doctor"
                    ? "คำขอลงทะเบียนคลินิกของท่านไม่ผ่านการอนุมัติจากผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบสำหรับข้อมูลเพิ่มเติม"
                    : "คำขอเข้าร่วมคลินิกของท่านไม่ผ่านการอนุมัติ กรุณาติดต่อแพทย์ประจำคลินิก",
                showSignOut: true,
            });
            case "user-suspended": return h(GateScreen, { title: "บัญชีถูกระงับ", body: "บัญชีของท่านถูกระงับการใช้งาน กรุณาติดต่อแพทย์ประจำคลินิก", showSignOut: true });
            case "clinic-suspended": return h(GateScreen, { title: "คลินิกถูกระงับ", body: "คลินิกนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", showSignOut: true });
            case "billing": return h(GateScreen, { title: "การสมัครสมาชิกหมดอายุ", body: "แผนการใช้งานของคลินิกหมดอายุหรือถูกยกเลิก กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุ", showSignOut: true });
            case "load-error": return h(GateScreen, { title: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ", body: (state.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ") + " — กรุณาลองออกจากระบบแล้วเข้าสู่ระบบใหม่ หรือติดต่อผู้ดูแลระบบหากยังพบปัญหา", showSignOut: true });
            case "pdpa": return h(PDPAModal, { onAccept: acceptPDPA });
            case "super-admin": return h(SuperAdminPortal, {});
            case "app": return h(window.AppRoot);
            default: return h(BootScreen, {});
        }
    }
    window.SaaSRootRouter = RootRouter;
})();
