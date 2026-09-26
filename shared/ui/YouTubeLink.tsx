import { LuYoutube } from 'react-icons/lu';

export function YouTubeLink({
  url,
  label,
  className = 'size-8 rounded-md text-current opacity-70 hover:opacity-100',
}: {
  url?: string;
  label: string;
  className?: string;
}) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center focus-visible:outline-2 ${className}`}
    >
      <LuYoutube aria-hidden="true" className="size-4" />
    </a>
  );
}
