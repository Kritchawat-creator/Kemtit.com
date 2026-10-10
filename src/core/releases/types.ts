export type LocalizedText = {
  th: string;
  en: string;
};

export type LocalizedItems = {
  th: string[];
  en: string[];
};

export type ReleaseNoteSummary = {
  id: string;
  version: string;
  buildId: string;
  publishedAt: string;
  title: LocalizedText;
  isRead: boolean;
};

export type ReleaseNote = ReleaseNoteSummary & {
  newItems: LocalizedItems;
  improvedItems: LocalizedItems;
  fixedItems: LocalizedItems;
};
