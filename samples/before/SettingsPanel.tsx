type SettingsPanelProps = {
  title: string;
  description: string;
};

export function SettingsPanel({ title, description }: SettingsPanelProps) {
  return (
    <section
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#1A1A1A',
        borderRadius: 8,
        padding: 16,
        rowGap: 8,
      }}
    >
      <div style={{ color: '#1A1A1A' }}>{title}</div>
      <p style={{ color: '#4B5563' }}>{description}</p>
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
