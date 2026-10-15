/**
 * Floating student imagery behind login / signup.
 * More visible plates + soft blend so the form stays readable.
 */
const SCENES = [
  {
    src: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85",
    className: "auth-float-a left-[-5%] top-[4%] h-[46%] w-[52%]",
  },
  {
    src: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=85",
    className: "auth-float-b right-[-4%] top-[12%] h-[42%] w-[46%]",
  },
  {
    src: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=85",
    className: "auth-float-c left-[6%] bottom-[-2%] h-[40%] w-[44%]",
  },
  {
    src: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=85",
    className: "auth-float-d right-[4%] bottom-[4%] h-[36%] w-[40%]",
  },
];

export default function AuthAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Deep base */}
      <div className="absolute inset-0 bg-[#060a14]" />

      {/* Brand glows */}

      {/* Photo plates */}
      {SCENES.map((scene, i) => (
        <div
          key={i}
          className={`absolute overflow-hidden rounded-[1.75rem] border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.5)] ${scene.className}`}
        >
          <img
            src={scene.src}
            alt=""
            loading="eager"
            decoding="async"
            className="h-full w-full scale-105 object-cover"
            style={{ opacity: 0.55 }}
          />
          {/* Soft edge blend only — keep faces readable */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F0326]/30 via-transparent to-[#0F0326]/55" />
        </div>
      ))}

      {/* Center soft focus so the form area is calmer */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,15,30,0.15)_0%,rgba(6,10,20,0.75)_70%)]" />

      {/* Grain */}
      <div className="auth-grain absolute inset-0 opacity-[0.06]" />
    </div>
  );
}
