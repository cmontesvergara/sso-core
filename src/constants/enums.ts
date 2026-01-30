/**
 * Enums and constants for the application
 */

export const maritalStatuses: { value: string; label: string }[] = [
  { value: 'SINGLE', label: 'Soltero/a' },
  { value: 'MARRIED', label: 'Casado/a' },
  { value: 'DIVORCED', label: 'Divorciado/a' },
  { value: 'WIDOWED', label: 'Viudo/a' },
];

export const genders: { value: string; label: string }[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
];

export const countries: { code: string; name: string }[] = [
  { code: 'CO', name: 'Colombia' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'ES', name: 'España' },
  { code: 'FR', name: 'Francia' },
  { code: 'DE', name: 'Alemania' },
  { code: 'IT', name: 'Italia' },
  { code: 'JP', name: 'Japón' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'RU', name: 'Rusia' },
  { code: 'ZA', name: 'Sudáfrica' },
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'CA', name: 'Canadá' },
];
