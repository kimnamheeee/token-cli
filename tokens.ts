export const primitive = {
  color: {
    blue500: '#2563EB',
    gray900: '#1A1A1A',
    white: '#FFFFFF',
  },
  spacing: {
    8: 8,
    16: 16,
  },
  radius: {
    md: 8,
  },
} as const;

export const semantic = {
  color: {
    actionPrimary: primitive.color.blue500,
    surfaceBrand: primitive.color.blue500,
    textDefault: primitive.color.gray900,
    borderStrong: primitive.color.gray900,
  },
  spacing: {
    contentGap: primitive.spacing[8],
    screenPadding: primitive.spacing[16],
  },
  radius: {
    control: primitive.radius.md,
  },
} as const;

export const component = {
  button: {
    primary: {
      backgroundColor: semantic.color.actionPrimary,
      color: primitive.color.white,
      borderRadius: semantic.radius.control,
      paddingHorizontal: semantic.spacing.screenPadding,
      paddingVertical: semantic.spacing.contentGap,
    },
  },
  card: {
    backgroundColor: semantic.color.surfaceBrand,
    borderColor: semantic.color.borderStrong,
    borderRadius: semantic.radius.control,
    padding: semantic.spacing.screenPadding,
  },
} as const;
