export const ERROR_COPY: Record<string, string> = {
  brand_not_found: 'Brand not found.',
  no_connected_accounts: 'No account connected for this brand.',
  accounts_not_found: 'One or more selected accounts are not valid.',
  delivery_failed: 'The post was created but scheduling failed. Try again from the calendar.',
  node_not_found: 'One of the selected items no longer exists.',
  brand_and_nodes_required: 'Choose a brand and at least one item.'
};

export function errorCopyFor(code: string): string {
  return ERROR_COPY[code] ?? 'Something went wrong. Try again.';
}
