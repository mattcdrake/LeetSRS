interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-current">
      <h1 className="text-xl font-bold text-primary">LeetReps</h1>
      {children}
    </div>
  );
}
