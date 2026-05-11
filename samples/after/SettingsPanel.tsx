import { component, primitive } from '../../tokens.js';

type SettingsPanelProps = {
  title: string;
  description: string;
};

export function SettingsPanel({ title, description }: SettingsPanelProps) {
  return (
    <section
      style={{
        backgroundColor: primitive.color.white,
        borderColor: component.card.borderColor,
        borderRadius: component.card.borderRadius,
        padding: component.card.padding,
        rowGap: component.button.primary.paddingVertical,
      }}
    >
      <div style={{ color: component.card.borderColor }}>{title}</div>
      <p style={{ color: component.card.borderColor }}>{description}</p>
      <button
        style={{
          backgroundColor: component.button.primary.backgroundColor,
          color: component.button.primary.color,
          borderRadius: component.button.primary.borderRadius,
          paddingHorizontal: component.button.primary.paddingHorizontal,
          paddingVertical: component.button.primary.paddingVertical,
        }}
      >
        Save changes
      </button>
    </section>
  );
}
