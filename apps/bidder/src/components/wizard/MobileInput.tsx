import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@auction/ui';
import { COUNTRY_CODES } from '../../lib/wizard';

export function MobileInput({
  id,
  label,
  countryCode,
  number,
  onCountryChange,
  onNumberChange,
  disabled,
  required = true,
}: {
  id: string;
  label: string;
  countryCode: string;
  number: string;
  onCountryChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={onCountryChange} disabled={disabled}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Code" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit number"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ''))}
          maxLength={15}
          disabled={disabled}
          required={required}
        />
      </div>
    </div>
  );
}
