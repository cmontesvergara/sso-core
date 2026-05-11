exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('audit_logs', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('audit_logs', 'tenant_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('audit_logs', 'tenant_id');
  pgm.dropColumn('audit_logs', 'tenant_id');
};
