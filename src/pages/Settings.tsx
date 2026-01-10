import { SimpleGrid, Stack } from "@mantine/core";
import { CategoryManager } from "../components/settings/CategoryManager";
import { PaymentManager } from "../components/settings/PaymentManager";
import { TagManager } from "../components/settings/TagManager";

export const Settings = () => (
  <Stack gap="lg">
    <CategoryManager />
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <PaymentManager />
      <TagManager />
    </SimpleGrid>
  </Stack>
);
