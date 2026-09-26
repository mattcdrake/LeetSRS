import type { ReactNode } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { LuCheck, LuChevronsUpDown } from 'react-icons/lu';
import { compactGhostButton, menuItem, menuPopover } from '@/popup/styles';
import { RowText, settingsRow } from './SettingsGroup';

export interface SettingsSelectOption<Value extends string> {
  value: Value;
  label: string;
  /** Extra content shown only in the list, such as a date or tag. */
  detail?: ReactNode;
}

interface SettingsSelectProps<Value extends string> {
  label: string;
  hint?: ReactNode;
  options: SettingsSelectOption<Value>[];
  value: Value | null;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  onChange: (value: Value) => void;
}

export function SettingsSelect<Value extends string>({
  label,
  hint,
  options,
  value,
  placeholder,
  isDisabled,
  className = settingsRow,
  onChange,
}: SettingsSelectProps<Value>) {
  return (
    <Select
      className={className}
      value={value}
      placeholder={placeholder}
      isDisabled={isDisabled}
      onChange={(key) => {
        const option = options.find((option) => option.value === key);
        if (option) onChange(option.value);
      }}
    >
      <RowText label={<Label>{label}</Label>} hint={hint} />
      <Button className={`${compactGhostButton} max-w-44 pr-1.5`}>
        <SelectValue className="truncate">
          {({ selectedText, defaultChildren }) => selectedText ?? defaultChildren}
        </SelectValue>
        <LuChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
      </Button>
      <Popover placement="bottom end" offset={4} className={`${menuPopover} max-w-72 overflow-y-auto`}>
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBoxItem key={option.value} id={option.value} textValue={option.label} className={menuItem}>
              {({ isSelected }) => (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                    {option.detail}
                  </span>
                  <LuCheck
                    aria-hidden="true"
                    className={`size-3.5 shrink-0 text-accent ${isSelected ? '' : 'invisible'}`}
                  />
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
