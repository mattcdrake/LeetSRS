import { FaYoutube } from 'react-icons/fa6';

export function YouTubeLink({
  url,
  label,
  className = 'size-8 rounded-md opacity-70 hover:opacity-100',
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
      className={`inline-flex shrink-0 items-center justify-center text-current focus-visible:outline-2 ${className}`}
    >
      <FaYoutube aria-hidden="true" className="size-4" />
    </a>
  );
}
