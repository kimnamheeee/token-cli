import { component, semantic } from '../../tokens.js';

export function PromoBanner() {
  return (
    <section
      style={{
        backgroundColor: component.card.backgroundColor,
        borderColor: component.card.borderColor,
        borderRadius: component.card.borderRadius,
        padding: component.card.padding,
        rowGap: semantic.spacing.contentGap,
      }}
    >
      <strong style={{ color: semantic.color.textDefault }}>Spring launch</strong>
      <p style={{ color: semantic.color.borderStrong }}>
        Upgrade your workspace and keep the whole team aligned.
      </p>
      <a
        href="/launch"
        style={{
          color: semantic.color.actionPrimary,
        }}
      >
        View details
      </a>
    </section>
  );
}
