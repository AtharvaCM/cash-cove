import { SimpleGrid, Stack } from "@mantine/core";
import { CategoryManager } from "../components/settings/CategoryManager";
import { AccountManager } from "../components/settings/AccountManager";
import { PaymentManager } from "../components/settings/PaymentManager";
import { TagManager } from "../components/settings/TagManager";

export const Settings = () => (
  <Stack gap="lg">
    <CategoryManager />
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <AccountManager />
      <PaymentManager />
      <TagManager />
    </SimpleGrid>
  </Stack>
);
