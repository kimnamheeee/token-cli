export function PromoBanner() {
  return (
    <section
      style={{
        backgroundColor: '#FFF7ED',
        borderColor: '#FED7AA',
        borderRadius: 14,
        padding: 28,
        rowGap: 12,
      }}
    >
      <strong
        style={{
          color: '#1D4ED8',
          marginBottom: 8,
        }}
      >
        New team workspace rollout
      </strong>

      <p
        style={{
          color: '#334155',
          marginBottom: 16,
        }}
      >
        Centralize approvals, notifications, and release notes in a single shared view.
      </p>

      <a
        href="/workspace"
        style={{
          color: '#2563EB',
        }}
      >
        Open workspace settings
      </a>
    </section>
  );
}
