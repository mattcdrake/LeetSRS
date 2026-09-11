// System theme changed the application default, not the stored logical dataset.
export const addSystemTheme = {
  description: 'Add system theme preference',
  migrate<T>(data: T): T {
    return data;
  },
};
