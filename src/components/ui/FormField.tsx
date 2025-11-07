import React from 'react';
import {
  Box,
  Input,
  Textarea,
  Text,
  Stack,
} from '@chakra-ui/react';
import { UseFormRegister, FieldError } from 'react-hook-form';

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'time' | 'color' | 'textarea' | 'select';
  register: UseFormRegister<any>;
  error?: FieldError;
  required?: boolean;
  helperText?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rows?: number;
}

/**
 * Reusable form field component with built-in validation display.
 * Works seamlessly with React Hook Form.
 * Compatible with Chakra UI v3.
 */
export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  register,
  error,
  required = false,
  helperText,
  placeholder,
  options,
  rows = 4,
}) => {
  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <Textarea
          {...register(name)}
          placeholder={placeholder}
          rows={rows}
          borderColor={error ? 'red.500' : 'border.subtle'}
          _focus={{
            borderColor: error ? 'red.500' : 'brand.primary',
            boxShadow: error ? '0 0 0 1px var(--chakra-colors-red-500)' : '0 0 0 1px var(--chakra-colors-brand-primary)',
          }}
        />
      );
    }

    if (type === 'select' && options) {
      return (
        <Box
          as="select"
          {...register(name)}
          borderWidth="1px"
          borderRadius="md"
          borderColor={error ? 'red.500' : 'border.subtle'}
          px={3}
          py={2}
          bg="bg.surface"
          width="100%"
          _focus={{
            borderColor: error ? 'red.500' : 'brand.primary',
            boxShadow: error ? '0 0 0 1px var(--chakra-colors-red-500)' : '0 0 0 1px var(--chakra-colors-brand-primary)',
            outline: 'none',
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Box>
      );
    }

    return (
      <Input
        {...register(name)}
        type={type}
        placeholder={placeholder}
        borderColor={error ? 'red.500' : 'border.subtle'}
        _focus={{
          borderColor: error ? 'red.500' : 'brand.primary',
          boxShadow: error ? '0 0 0 1px var(--chakra-colors-red-500)' : '0 0 0 1px var(--chakra-colors-brand-primary)',
        }}
      />
    );
  };

  return (
    <Stack gap={1.5}>
      <Text
        as="label"
        fontSize="sm"
        fontWeight="600"
        color="text.primary"
        display="flex"
        alignItems="center"
        gap={1}
      >
        {label}
        {required && (
          <Text as="span" color="red.500">
            *
          </Text>
        )}
      </Text>
      {renderInput()}
      {error && (
        <Text fontSize="xs" color="red.500">
          {error.message}
        </Text>
      )}
      {helperText && !error && (
        <Text fontSize="xs" color="text.secondary">
          {helperText}
        </Text>
      )}
    </Stack>
  );
};
