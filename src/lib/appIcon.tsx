// Shared artwork for the home-screen and favicon images (rendered by next/og at build time).
export function AppIconArt({ size }: { size: number }) {
  const s = size;
  return (
    <div
      style={{
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 35% 30%, #16202d 0%, #07090d 70%)",
      }}
    >
      <svg width={s * 0.78} height={s * 0.78} viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="15.5" fill="none" stroke="#2e3a4c" strokeWidth="0.9" />
        <ellipse cx="17" cy="17" rx="15.5" ry="6" fill="none" stroke="#3ed6b5" strokeOpacity="0.55" strokeWidth="0.9" transform="rotate(-25 17 17)" />
        <path d="M5 18h6.5l2.5-6 4 11 3-8 1.5 3H29" fill="none" stroke="#3ed6b5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
