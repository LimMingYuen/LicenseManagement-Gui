import { LicenseKind, LicenseTier, LicenseWithFile } from '../../../models/license.models';
import { LicenseService } from '../../../services/license.service';

/** One identifier field on a generate form. */
export interface GenerateFieldConfig {
  /** Form control name; also the request property. */
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  /** Identifiers render monospaced so operators can compare them character by character. */
  mono?: boolean;
  /** Left blank without blocking submission. Only the gateway's parent machine is. */
  optional?: boolean;
  maxLength: number;
}

export interface GenerateConfig {
  kind: LicenseKind;
  title: string;
  subtitle: string;
  icon: string;
  /** A note about how this license type binds, shown above the form. */
  banner: string;
  /** Label for the bound identifier, used in the preview and result panels. */
  targetLabel: string;
  /** The control whose value is the bound identifier. */
  targetKey: string;
  fields: GenerateFieldConfig[];
  tiers: LicenseTier[];
  submitLabel: string;
  /** Which service call to make. Keeps the shared form free of a type switch. */
  submit: (service: LicenseService, value: Record<string, unknown>) => Promise<LicenseWithFile>;
}

// The customer is no longer one of these fields. It is a picker over the customer register,
// rendered by the shared form itself, because all three license types need it and it carries
// its own create-inline behaviour rather than being a plain text box.

export const MACHINE_CONFIG: GenerateConfig = {
  kind: 'Machine',
  title: 'Machine License',
  subtitle: "Issue a license bound to a customer's machine",
  icon: 'precision_manufacturing',
  banner:
    'Machine licenses are bound to a single machine ID. Dashes are stripped, so MACHINE-001 ' +
    'and MACHINE001 produce the same binding.',
  targetLabel: 'Machine ID',
  targetKey: 'machineId',
  fields: [
    {
      key: 'machineId',
      label: 'Machine ID',
      placeholder: 'MACHINE-001',
      mono: true,
      maxLength: 100,
    },
  ],
  tiers: ['PERPETUAL', 'SUBSCRIPTION', 'TRIAL'],
  submitLabel: 'Generate license',
  submit: (service, v) =>
    service.generateMachine({
      machineId: v['machineId'] as string,
      applicationId: v['applicationId'] as number,
      customerId: v['customerId'] as number,
      licenseType: v['licenseType'] as LicenseTier,
      expiresAt: v['expiresAt'] as string | null,
      notes: v['notes'] as string | null,
    }),
};

export const ROBOT_CONFIG: GenerateConfig = {
  kind: 'Robot',
  title: 'Robot License',
  subtitle: 'Issue a license for a robot on a specific machine',
  icon: 'smart_toy',
  banner:
    'Robot licenses are tied to both a robot ID and a machine ID. The robot will only ' +
    'operate on the machine named here.',
  targetLabel: 'Robot ID',
  targetKey: 'robotId',
  fields: [
    { key: 'robotId', label: 'Robot ID', placeholder: 'ROBOT-A14', mono: true, maxLength: 100 },
    { key: 'machineId', label: 'Machine ID', placeholder: 'MACHINE-001', mono: true, maxLength: 100 },
  ],
  // No trial tier for robots - matches the desktop app.
  tiers: ['PERPETUAL', 'SUBSCRIPTION'],
  submitLabel: 'Generate robot license',
  submit: (service, v) =>
    service.generateRobot({
      robotId: v['robotId'] as string,
      machineId: v['machineId'] as string,
      applicationId: v['applicationId'] as number,
      customerId: v['customerId'] as number,
      licenseType: v['licenseType'] as LicenseTier,
      expiresAt: v['expiresAt'] as string | null,
      notes: v['notes'] as string | null,
    }),
};

export const GATEWAY_CONFIG: GenerateConfig = {
  kind: 'Gateway',
  title: 'Gateway License',
  subtitle: 'Issue a license for the OMRON DI Gateway Android app',
  icon: 'router',
  banner:
    'Gateway licenses are tied to one Android device via its device ID. The app will only ' +
    'run on that device. Naming a machine files the device under it in the catalog.',
  targetLabel: 'Device ID',
  targetKey: 'deviceId',
  fields: [
    {
      key: 'deviceId',
      label: 'Device ID',
      placeholder: 'A1B2-C3D4-E5F6-7G8H-9I0J-K1L2-M3N4-O5P6',
      hint: "Read it from the gateway app's License screen. Case and spaces are normalised.",
      mono: true,
      maxLength: 100,
    },
    {
      key: 'machineId',
      label: 'Machine ID (optional)',
      placeholder: 'MACHINE-001',
      hint:
        'Files the device under a machine in the license catalog. Registry only — it is ' +
        'never written into the signed file, so the gateway app is unaffected.',
      mono: true,
      optional: true,
      maxLength: 100,
    },
  ],
  tiers: ['PERPETUAL', 'SUBSCRIPTION', 'TRIAL'],
  submitLabel: 'Generate gateway license',
  submit: (service, v) =>
    service.generateGateway({
      deviceId: v['deviceId'] as string,
      machineId: (v['machineId'] as string | null) || null,
      applicationId: v['applicationId'] as number,
      customerId: v['customerId'] as number,
      licenseType: v['licenseType'] as LicenseTier,
      expiresAt: v['expiresAt'] as string | null,
      notes: v['notes'] as string | null,
    }),
};
