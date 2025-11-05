import React from 'react';
import { Stack, Heading, Text, Flex, Box } from '@chakra-ui/react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  spacing?: number;
  media?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  meta,
  actions,
  spacing = 4,
  media,
}) => (
  <Stack
    gap={spacing}
    pb={4}
    borderBottom="1px solid"
    borderColor="border.subtle"
    mb={{ base: 4, md: 6 }}
  >
    <Stack
      direction={{ base: 'column', md: 'row' }}
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      gap={4}
    >
      <Stack direction="row" align="center" gap={3}>
        {media && <Box>{media}</Box>}
        <Stack gap={1}>
          <Heading size="lg" color="brand.primary" fontWeight="700">
            {title}
          </Heading>
          {subtitle && (
            <Text color="brand.secondary" fontSize="md" fontWeight="500">
              {subtitle}
            </Text>
          )}
        </Stack>
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
    </Stack>
    {meta && <Box>{meta}</Box>}
  </Stack>
);

export default PageHeader;
