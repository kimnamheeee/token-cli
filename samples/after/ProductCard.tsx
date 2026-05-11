import { component, primitive } from '../../tokens.js';

type ProductCardProps = {
  title: string;
  category: string;
  price: string;
};

export function ProductCard({ title, category, price }: ProductCardProps) {
  return (
    <article
      style={{
        backgroundColor: component.card.backgroundColor,
        borderColor: component.card.borderColor,
        borderRadius: component.card.borderRadius,
        padding: component.card.padding,
        rowGap: component.button.primary.paddingVertical,
      }}
    >
      <div style={{ color: primitive.color.white }}>{category}</div>
      <h3 style={{ color: primitive.color.white, marginBottom: component.button.primary.paddingVertical }}>
        {title}
      </h3>
      <p style={{ color: component.card.borderColor }}>{price}</p>
      <button
        style={{
          backgroundColor: component.button.primary.backgroundColor,
          color: component.button.primary.color,
          borderRadius: component.button.primary.borderRadius,
          paddingHorizontal: component.button.primary.paddingHorizontal,
          paddingVertical: component.button.primary.paddingVertical,
        }}
      >
        Add to cart
      </button>
    </article>
  );
}
