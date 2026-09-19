import { FaYoutube } from 'react-icons/fa6';

export function YouTubeLink({ url, label }: { url?: string; label: string }) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-current opacity-70 hover:opacity-100 focus-visible:outline-2"
    >
      <FaYoutube aria-hidden="true" className="size-4" />
    </a>
  );
}
