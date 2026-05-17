type OrderSummaryProps = {
  subtotal: string;
  shipping: string;
  total: string;
};

export function OrderSummary({
  subtotal,
  shipping,
  total,
}: OrderSummaryProps) {
  return (
    <aside
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 32,
        rowGap: 12,
      }}
    >
      <h4
        style={{
          color: '#0F172A',
          marginBottom: 12,
        }}
      >
        Order summary
      </h4>

      <div style={{ color: '#334155', marginBottom: 8 }}>Subtotal: {subtotal}</div>
      <div style={{ color: '#334155', marginBottom: 8 }}>Shipping: {shipping}</div>
      <div style={{ color: '#0F172A', marginBottom: 16 }}>Total: {total}</div>

      <button
        style={{
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        Continue to payment
      </button>
    </aside>
  );
}
