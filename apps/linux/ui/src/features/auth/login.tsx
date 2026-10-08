import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Library, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { gateway, nativeAvailable } from "../../lib/bridge";
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const client = useQueryClient();
  const login = useMutation({
    mutationFn: gateway.login,
    onSuccess: (session) => {
      setPassword("");
      client.setQueryData(["session"], session);
    },
  });
  return (
    <main className="login-screen">
      <section className="login-intro">
        <div className="brand">
          <span className="brand-symbol">
            <Library />
          </span>
          <span>
            نحّاسيو<small>NAHHASIO</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">مكتبتنا، بطريقتنا</p>
          <h1>
            كل حكاية.
            <br />
            في مكانها.
          </h1>
          <p className="intro-copy">
            أعمال نختارها بعناية، وتفاصيل تساعدنا على الاختيار. مساحة واحدة لمكتبة العائلة.
          </p>
        </div>
        <p className="login-footnote">
          <ShieldCheck size={18} /> مكتبتك متصلة بخادمك الخاص
        </p>
      </section>
      <section className="login-form-region">
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <p className="eyebrow">أهلًا بك</p>
          <h2>ادخل إلى مكتبتك</h2>
          <p className="muted">استخدم حسابك في خادم نحّاسيو.</p>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {!nativeAvailable() && (
            <p className="error" role="alert">
              افتح هذه الواجهة من تطبيق Linux للاتصال بالخادم.
            </p>
          )}
          {login.error && (
            <p className="error" role="alert">
              {login.error.message}
            </p>
          )}
          <button
            className="primary-button"
            disabled={login.isPending || !nativeAvailable()}
            type="submit"
          >
            {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
            <ArrowLeft size={18} />
          </button>
          <p className="login-caption">تُحفظ جلسة الدخول داخل التطبيق فقط.</p>
        </form>
      </section>
    </main>
  );
}
