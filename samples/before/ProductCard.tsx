type ProductCardProps = {
  title: string;
  category: string;
  price: string;
};

export function ProductCard({ title, category, price }: ProductCardProps) {
  return (
    <article
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        rowGap: 12,
      }}
    >
      <div
        style={{
          backgroundColor: '#F8FAFC',
          color: '#64748B',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginBottom: 12,
        }}
      >
        {category}
      </div>

      <h3
        style={{
          color: '#0F172A',
          marginBottom: 8,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          color: '#334155',
          marginBottom: 20,
        }}
      >
        Lightweight shell jacket for transitional weather.
      </p>

      <div
        style={{
          color: '#059669',
          marginBottom: 16,
        }}
      >
        {price}
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
        Add to cart
      </button>
    </article>
  );
}
