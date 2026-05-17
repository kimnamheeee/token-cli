export const primitive = {
  color: {
    white: '#FFFFFF',
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate500: '#64748B',
    slate700: '#334155',
    slate900: '#0F172A',
    blue50: '#EFF6FF',
    blue600: '#2563EB',
    blue700: '#1D4ED8',
    emerald600: '#059669',
    amber500: '#F59E0B',
  },
  spacing: {
    4: 4,
    8: 8,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    28: 28,
    32: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};

export const semantic = {
  color: {
    surfaceDefault: primitive.color.white,
    surfaceMuted: primitive.color.slate50,
    surfaceInfo: primitive.color.blue50,
    textDefault: primitive.color.slate900,
    textSecondary: primitive.color.slate700,
    textMuted: primitive.color.slate500,
    textOnBrand: primitive.color.white,
    borderSubtle: primitive.color.slate200,
    actionPrimary: primitive.color.blue600,
    actionPrimaryHover: primitive.color.blue700,
    statusSuccess: primitive.color.emerald600,
    statusWarning: primitive.color.amber500,
  },
  spacing: {
    insetSm: primitive.spacing[8],
    insetMd: primitive.spacing[16],
    insetLg: primitive.spacing[24],
    stackSm: primitive.spacing[8],
    stackMd: primitive.spacing[12],
    stackLg: primitive.spacing[16],
  },
  radius: {
    control: primitive.radius.sm,
    surface: primitive.radius.md,
    overlay: primitive.radius.lg,
  },
};

export const component = {
  card: {
    default: {
      backgroundColor: semantic.color.surfaceDefault,
      borderColor: semantic.color.borderSubtle,
      borderRadius: semantic.radius.surface,
      padding: semantic.spacing.insetMd,
      rowGap: semantic.spacing.stackMd,
    },
    elevated: {
      backgroundColor: semantic.color.surfaceDefault,
      borderColor: semantic.color.borderSubtle,
      borderRadius: semantic.radius.overlay,
      padding: semantic.spacing.insetLg,
      rowGap: semantic.spacing.stackLg,
    },
  },
  button: {
    primary: {
      backgroundColor: semantic.color.actionPrimary,
      color: semantic.color.textOnBrand,
      borderRadius: semantic.radius.control,
      paddingHorizontal: primitive.spacing[16],
      paddingVertical: primitive.spacing[8],
    },
  },
  badge: {
    neutral: {
      backgroundColor: semantic.color.surfaceMuted,
      color: semantic.color.textMuted,
      borderRadius: semantic.radius.control,
      paddingHorizontal: primitive.spacing[8],
      paddingVertical: primitive.spacing[4],
    },
  },
};
