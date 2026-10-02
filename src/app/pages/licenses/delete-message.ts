import { License } from '../../models/license.models';

/**
 * Confirmation text for deleting a license. Signed files are verified offline, so deleting the
 * record does not stop a copy already on the customer's side from working.
 */
export function deleteMessage(license: License): string {
  return (
    `This permanently removes the ${license.type.toLowerCase()} license for ` +
    `${license.customerName} (${license.targetId}) from the register. ` +
    'A license file already installed on the target keeps working until it expires.'
  );
}
