export function PromoBanner() {
  return (
    <section
      style={{
        backgroundColor: '#F3F4F6',
        borderColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        rowGap: 8,
      }}
    >
      <strong style={{ color: '#1A1A1A' }}>Spring launch</strong>
      <p style={{ color: '#374151' }}>
        Upgrade your workspace and keep the whole team aligned.
      </p>
      <a
        href="/launch"
        style={{
          color: '#2563EB',
        }}
      >
        View details
      </a>
    </section>
  );
}
