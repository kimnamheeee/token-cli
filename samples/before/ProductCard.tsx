type ProductCardProps = {
  title: string;
  category: string;
  price: string;
};

export function ProductCard({ title, category, price }: ProductCardProps) {
  return (
    <article
      style={{
        backgroundColor: '#2563EB',
        borderColor: '#1A1A1A',
        borderRadius: 8,
        padding: 16,
        rowGap: 8,
      }}
    >
      <div style={{ color: '#FFFFFF' }}>{category}</div>
      <h3 style={{ color: '#FFFFFF', marginBottom: 8 }}>{title}</h3>
      <p style={{ color: '#1A1A1A' }}>{price}</p>
      <button
        style={{
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        Add to cart
      </button>
    </article>
  );
}
