import { Center, Paper, Stack, Text, Title } from "@mantine/core";

export const NotFound = () => (
  <Center mih="60vh">
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          404
        </Text>
        <Title order={3}>Page not found</Title>
        <Text size="sm" c="dimmed">
          That page does not exist in Sanchay.
        </Text>
      </Stack>
    </Paper>
  </Center>
);
