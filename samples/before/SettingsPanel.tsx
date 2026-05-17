type SettingsPanelProps = {
  title: string;
  description: string;
};

export function SettingsPanel({
  title,
  description,
}: SettingsPanelProps) {
  return (
    <section
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 24,
        rowGap: 20,
      }}
    >
      <div
        style={{
          color: '#0F172A',
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <p
        style={{
          color: '#334155',
          marginBottom: 16,
        }}
      >
        {description}
      </p>

      <div
        style={{
          backgroundColor: '#F8FAFC',
          borderColor: '#CBD5E1',
          borderRadius: 12,
          padding: 16,
          rowGap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ color: '#64748B', marginBottom: 8 }}>Email notifications</div>
        <strong style={{ color: '#0F172A' }}>Enabled for mentions and approvals</strong>
      </div>

      <button
        style={{
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        Save changes
      </button>
    </section>
  );
}
