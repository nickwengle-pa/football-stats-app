import React from 'react';
import { ChakraProvider, Box, Flex, Stack, Text, chakra, Image } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { TeamBranding } from '../../models';
import { useTeamTheme } from '../../theme/teamTheme';

interface NavItem {
  label: string;
  to: string;
}

const NavLink = chakra(Link);

const navItems: NavItem[] = [
  { label: 'Team', to: '/team' },
  { label: 'Schedule', to: '/' },
  { label: 'Scoring', to: '/scoring/:gameId' },
  { label: 'Reports', to: '/reports/:gameId' },
];

const isActivePath = (pathname: string, target: string) => {
  if (target === '/') return pathname === target;
  const base = target.replace(':gameId', '');
  return pathname.startsWith(base);
};

const SidebarContent: React.FC = () => {
  const location = useLocation();

  return (
    <Stack direction="column" align="stretch" gap={1} px={3} py={4}>
      {navItems.map((item) => {
        const active = isActivePath(location.pathname, item.to);
        return (
          <NavLink
            key={item.label}
            to={item.to.replace(':gameId', '')}
            borderRadius="md"
            px={3}
            py={2}
            fontWeight={active ? '600' : '500'}
            color={active ? 'brand.solid' : 'text.secondary'}
            bg={active ? 'brand.muted' : 'transparent'}
            _hover={{ textDecoration: 'none', bg: 'brand.muted', color: 'brand.solid' }}
          >
            {item.label}
          </NavLink>
        );
      })}
    </Stack>
  );
};

interface AppShellProps {
  children: React.ReactNode;
  branding?: TeamBranding | null;
  teamName?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, branding, teamName }) => {
  const location = useLocation();
  const { system, palette } = useTeamTheme(branding);
  const programLabel = teamName ?? 'PL Football';
  const logoUrl = palette.logoUrl;

  return (
    <ChakraProvider value={system}>
      <Flex minH="100vh" bg="bg.canvas">
        <Box
          display={{ base: 'none', md: 'block' }}
          w="250px"
          borderRight="1px solid"
          borderColor="border.subtle"
          bg="brand.surface"
        >
          <Box px={4} py={5}>
            {logoUrl && (
              <Box mb={3}>
                <Image
                  src={logoUrl}
                  alt={`${programLabel} logo`}
                  maxH="72px"
                  objectFit="contain"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="border.subtle"
                  bg="white"
                  p={2}
                />
              </Box>
            )}
            <Text fontSize="lg" fontWeight="700" color="brand.primary">
              {programLabel}
            </Text>
            <Text fontSize="sm" color="text.secondary">
              Season Command Center
            </Text>
            <Flex mt={3} gap={2}>
              <Box flex="1" height="6px" borderRadius="full" bg="brand.primary" />
              <Box flex="1" height="6px" borderRadius="full" bg="brand.secondary" />
              <Box flex="1" height="6px" borderRadius="full" bg="brand.accent" />
            </Flex>
          </Box>
          <Box borderBottom="1px solid" borderColor="border.subtle" />
          <SidebarContent />
        </Box>

        <Flex direction="column" flex="1">
          <Flex
            as="header"
            align="center"
            justify="space-between"
            px={4}
            py={3}
            borderBottom="1px solid"
          borderColor="brand.primary"
          bg="bg.surface"
          gap={3}
          flexWrap="wrap"
        >
            <Stack direction="row" align="center" gap={3}>
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={`${programLabel} logo`}
                  boxSize="48px"
                  objectFit="contain"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="border.subtle"
                  bg="white"
                  p={2}
                  display={{ base: 'none', md: 'block' }}
                />
              )}
              <Stack gap={1}>
                <Text fontWeight="600">{programLabel}</Text>
                <Text fontSize="sm" color="text.secondary">
                  Manage schedule, roster, and in-game stats
                </Text>
              </Stack>
            </Stack>

            <Stack direction="row" gap={2} width="100%" display={{ base: 'flex', md: 'none' }}>
              {navItems.map((item) => {
                const active = isActivePath(location.pathname, item.to);
                return (
                  <NavLink
                    key={`mobile-${item.label}`}
                    to={item.to.replace(':gameId', '')}
                    flex="1"
                    textAlign="center"
                    fontSize="sm"
                    fontWeight="600"
                    color={active ? 'white' : 'brand.primary'}
                    bg={active ? 'brand.primary' : 'brand.surface'}
                    py={2}
                    borderRadius="md"
                    _hover={{ textDecoration: 'none', bg: 'brand.primary', color: 'white' }}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </Stack>

            <Stack direction="column" gap={0.5} textAlign="right" display={{ base: 'none', md: 'flex' }}>
              <Text fontSize="sm" color="text.secondary">
                Logged in as
              </Text>
              <Text fontWeight="600">Coach Portal</Text>
            </Stack>
          </Flex>

          <Box as="main" flex="1" p={{ base: 4, md: 6 }}>
            {children}
          </Box>
        </Flex>
      </Flex>
    </ChakraProvider>
  );
};

export default AppShell;
