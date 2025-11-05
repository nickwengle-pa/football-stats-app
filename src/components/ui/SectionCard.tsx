import React from 'react';
import { Box, Stack, Heading, Text, Flex } from '@chakra-ui/react';

export interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  spacing?: number;
  padding?: number | { base?: number; md?: number };
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  spacing = 4,
  padding = { base: 4, md: 6 },
}) => (
  <Box
    bg="bg.surface"
    border="1px solid"
    borderColor="border.subtle"
    borderRadius="xl"
    boxShadow="sm"
    p={padding}
  >
    <Stack gap={spacing}>
      {(title || description || actions) && (
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          gap={3}
        >
          <Stack gap={1}>
            {title && (
              <Heading size="md" color="brand.primary" fontWeight="700">
                {title}
              </Heading>
            )}
            {description && (
              <Text color="brand.secondary" fontWeight="500">
                {description}
              </Text>
            )}
          </Stack>
          {actions && (
            <Flex
              align="center"
              justify={{ base: 'flex-start', md: 'flex-end' }}
              gap={2}
              flexWrap="wrap"
              width={{ base: '100%', md: 'auto' }}
            >
              {actions}
            </Flex>
          )}
        </Flex>
      )}
      <Box>{children}</Box>
    </Stack>
  </Box>
);

export default SectionCard;
