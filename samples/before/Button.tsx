type ButtonProps = {
  label: string;
};

export function Button({ label }: ButtonProps) {
  const dynamicPadding = 20;

  return (
    <button
      style={{
        backgroundColor: '#2563eb',
        color: '#ffffff',
        padding: '16px',
        marginTop: `8px`,
        borderRadius: 12,
        width: dynamicPadding,
      }}
    >
      {label}
    </button>
  );
}
