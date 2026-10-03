import { Alert, Button, ConfigProvider, Drawer, Dropdown, Input, Modal, Radio, Space, Table, message, type MenuProps, type TableColumnType, type TableProps } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { MoreOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import useStore from "../../store/store"
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useEffect, useState } from "react";
import { ColumnSearchDropdown } from "../ColumnSearchDropdown";
import { extractErrorMessage } from "../../utils/api";

interface TeamItem {
    user_id: string;
    user_email: string;
    user_first_name: string;
    user_last_name: string;
    user_role: string;
    verified_at: string | null;
    otp: string
}

// Column-search dropdown, matching the "Data Processing Pipeline" table's
// per-column filter style (see UploadView.tsx's fileColumnSearchProps).
// The actual filtering happens server-side, so onFilter is a no-op: the rows
// this table receives are already exactly the filtered/sorted/paginated page.
const searchProps = (label: string): TableColumnType<TeamItem> => ({
    filterDropdown: (props) => <ColumnSearchDropdown {...props} label={label} />,
    filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? '#4f46e5' : undefined }} />
    ),
    onFilter: () => true,
});

const initCap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

// Role is a small fixed set of values, so — like the Marketplace/Status columns
// on the Data Processing Pipeline table — it gets a single-select (radio)
// filter list instead of a free-text search dropdown.
const roleFilters = [
    { text: 'Admin', value: 'admin' },
    { text: 'Member', value: 'member' },
];

// "Show Verification Link" only makes sense while the member is still Pending
// (i.e. hasn't verified/set a password yet).
const getActionMenuItems = (record: TeamItem): MenuProps['items'] => [
    { key: 'change-role', label: 'Change Role' },
    ...(!record.verified_at ? [{ key: 'verify-link', label: 'Show Verification Link' }] : []),
    { key: 'delete', label: 'Delete', danger: true },
];

// Placeholder only — the real verification URL format/route hasn't been
// decided yet. Keeping it isolated here means it's a one-line change later.
const buildVerificationUrl = (otp: string) => `${window.location.origin}/verify?token=${otp}`;

const emptyNewMember = {
    user_email: '',
    user_first_name: '',
    user_last_name: '',
    user_role: 'member',
};

const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
};

export const TeamView: React.FC = () => {
    const { getTeamMembers, registerMember, changeUserRole, deleteUser, members, totalMembers } = useStore();
    const [authToken] = useLocalStorage('access_token');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
    const [sorter, setSorter] = useState<SorterResult<TeamItem> | null>(null);
    const [roleModalTarget, setRoleModalTarget] = useState<TeamItem | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>('admin');
    const [isChangingRole, setIsChangingRole] = useState(false);
    const [verifyLinkTarget, setVerifyLinkTarget] = useState<TeamItem | null>(null);
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [newMember, setNewMember] = useState(emptyNewMember);
    const [addMemberError, setAddMemberError] = useState('');
    const [isSubmittingMember, setIsSubmittingMember] = useState(false);
    const { decoded_token: { user_id: userId }} = authToken;

    const fetchMembers = () => {
        const filterPayload = Object.fromEntries(
            Object.entries(filters)
                .filter(([, value]) => value && value[0] !== undefined && value[0] !== '')
                .map(([key, value]) => [key, value![0]])
        );
        const sortPayload = sorter?.order && sorter.columnKey
            ? { [String(sorter.columnKey)]: sorter.order === 'ascend' ? 'asc' : 'desc' }
            : {};

        getTeamMembers(authToken.access_token, {
            page,
            size: pageSize,
            filter: filterPayload,
            sort: sortPayload,
        });
    };

    const openAddDrawer = () => {
        setNewMember(emptyNewMember);
        setAddMemberError('');
        setIsAddDrawerOpen(true);
    };

    const closeAddDrawer = () => {
        setIsAddDrawerOpen(false);
    };

    const handleAddMember = async () => {
        if (!newMember.user_email.trim() || !newMember.user_first_name.trim() || !newMember.user_last_name.trim()) {
            setAddMemberError('Please fill in email, first name, and last name.');
            return;
        }

        setAddMemberError('');
        setIsSubmittingMember(true);
        try {
            const { otp } = await registerMember(authToken.access_token, newMember);
            message.success(`Team member added. OTP: ${otp}`);
            closeAddDrawer();
            fetchMembers();
        } catch (err) {
            setAddMemberError(extractErrorMessage(err, 'Something went wrong.'));
        } finally {
            setIsSubmittingMember(false);
        }
    };

    const handleCopyVerificationLink = () => {
        if (!verifyLinkTarget) return;
        const url = buildVerificationUrl(verifyLinkTarget.otp);
        navigator.clipboard?.writeText(url).then(
            () => message.success('Verification link copied.'),
            () => message.error('Could not copy the link.'),
        );
    };

    const openChangeRoleModal = (record: TeamItem) => {
        setRoleModalTarget(record);
        setSelectedRole(record.user_role || 'admin');
    };

    const closeChangeRoleModal = () => {
        setRoleModalTarget(null);
    };

    const confirmChangeRole = async () => {
        if (!roleModalTarget) return;
        // Unlike Modal.confirm, the plain <Modal> component doesn't manage
        // loading/closing from onOk's returned promise itself — that's done
        // explicitly here via isChangingRole and closeChangeRoleModal().
        setIsChangingRole(true);
        try {
            await changeUserRole(authToken.access_token, roleModalTarget.user_id, selectedRole);
            message.success(`Role updated for ${roleModalTarget.user_email}.`);
            closeChangeRoleModal();
            fetchMembers();
        } catch (err) {
            message.error(extractErrorMessage(err, 'Something went wrong.'));
        } finally {
            setIsChangingRole(false);
        }
    };

    const confirmDelete = (record: TeamItem) => {
        Modal.confirm({
            title: 'Delete team member',
            content: `Are you sure you want to delete ${record.user_email}? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await deleteUser(authToken.access_token, record.user_id);
                    message.success(`${record.user_email} was deleted.`);
                    fetchMembers();
                } catch (err) {
                    message.error(extractErrorMessage(err, 'Something went wrong.'));
                    throw err;
                }
            },
        });
    };

    useEffect(() => {
        fetchMembers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, filters, sorter, authToken.access_token, getTeamMembers]);

    const columns: TableProps<TeamItem>['columns'] = [
        {
            dataIndex: 'user_email',
            key: 'user_email',
            title: 'Email',
            sorter: true,
            sortOrder: sorter?.columnKey === 'user_email' ? sorter.order : null,
            filteredValue: filters.user_email ?? null,
            ...searchProps('email'),
            render: (record: string) => (
                <span className="font-semibold text-slate-900">{record}</span>
            ),
        },
        {
            dataIndex: 'user_first_name',
            key: 'user_first_name',
            title: 'First Name',
            sorter: true,
            sortOrder: sorter?.columnKey === 'user_first_name' ? sorter.order : null,
            filteredValue: filters.user_first_name ?? null,
            ...searchProps('first name'),
            render: (record: string) => (
                <span className="font-semibold text-slate-900">{record}</span>
            ),
        },
        {
            dataIndex: 'user_last_name',
            key: 'user_last_name',
            title: 'Last Name',
            sorter: true,
            sortOrder: sorter?.columnKey === 'user_last_name' ? sorter.order : null,
            filteredValue: filters.user_last_name ?? null,
            ...searchProps('last name'),
            render: (record: string) => (
                <span className="font-semibold text-slate-900">{record}</span>
            ),
        },
        {
            dataIndex: 'user_role',
            key: 'user_role',
            title: 'Role',
            sorter: true,
            sortOrder: sorter?.columnKey === 'user_role' ? sorter.order : null,
            filteredValue: filters.user_role ?? null,
            filters: roleFilters,
            filterMultiple: false,
            onFilter: () => true,
            render: (record: string) => (
                <span className="font-semibold text-slate-900">{initCap(record)}</span>
            ),
        },
        {
            key: 'status',
            title: 'Status',
            render: (_, record) => (
                record.verified_at
                    ? <span className="status-tag status-active-tag">Active</span>
                    : <span className="status-tag status-pending-tag">Pending</span>
            ),
        },
        {
            key: 'actions',
            title: 'Action',
            align: 'right',
            width: 72,
            render: (_, record) => (
                <Dropdown
                    disabled={userId === record.user_id}
                    trigger={['click']}
                    menu={{
                        items: getActionMenuItems(record),
                        onClick: ({ key }) => {
                            if (key === 'delete') {
                                confirmDelete(record);
                            } else if (key === 'change-role') {
                                openChangeRoleModal(record);
                            } else if (key === 'verify-link') {
                                setVerifyLinkTarget(record);
                            }
                        },
                    }}
                >
                    <Button type="text" icon={<MoreOutlined />} aria-label="Row actions" />
                </Dropdown>
            ),
        },
    ]

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#4f46e5',
                    borderRadius: 8,
                },
          }}>
            <div className="view-container">
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="card-header-flex" style={{ padding: '16px 16px 0' }}>
                        <h4 className="section-title">Team Members</h4>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={openAddDrawer}
                        >
                            Add Team Member
                        </Button>
                    </div>
                    <Table<TeamItem>
                        rowKey='user_id'
                        columns={columns}
                        dataSource={members}
                        pagination={{
                            current: page,
                            pageSize,
                            total: totalMembers,
                            showSizeChanger: true,
                            pageSizeOptions: ['5', '10', '20'],
                            showTotal: () => `Total ${totalMembers} members`,
                        }}
                        onChange={(pagination, nextFilters, nextSorter) => {
                            const nextSorterResult = Array.isArray(nextSorter) ? nextSorter[0] ?? null : nextSorter;
                            const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters);
                            const sorterChanged =
                                nextSorterResult?.field !== sorter?.field ||
                                nextSorterResult?.order !== sorter?.order;

                            setFilters(nextFilters);
                            setSorter(nextSorterResult);
                            setPageSize(pagination.pageSize ?? pageSize);
                            // A new filter/sort makes the old page number meaningless, so jump back to page 1.
                            setPage(filtersChanged || sorterChanged ? 1 : (pagination.current ?? 1));
                        }}
                    />
                </div>
            </div>

            <Modal
                title="Change Role"
                open={roleModalTarget !== null}
                onOk={confirmChangeRole}
                onCancel={closeChangeRoleModal}
                confirmLoading={isChangingRole}
                okText="Confirm"
                cancelText="Cancel"
            >
                <p>
                    Select a new role for <strong>{roleModalTarget?.user_email}</strong>:
                </p>
                <Radio.Group
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    options={[
                        { label: 'Admin', value: 'admin' },
                        { label: 'Member', value: 'member' },
                    ]}
                />
            </Modal>

            <Modal
                title="Verification Link"
                open={verifyLinkTarget !== null}
                onCancel={() => setVerifyLinkTarget(null)}
                footer={[
                    <Button key="copy" onClick={handleCopyVerificationLink}>Copy Link</Button>,
                    <Button key="close" type="primary" onClick={() => setVerifyLinkTarget(null)}>Close</Button>,
                ]}
            >
                <p>
                    Share this link with <strong>{verifyLinkTarget?.user_email}</strong> to complete verification:
                </p>
                <Input readOnly value={verifyLinkTarget ? buildVerificationUrl(verifyLinkTarget.otp) : ''} />
                <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                    Note: this URL format is a placeholder and will be finalized later.
                </p>
            </Modal>

            <Drawer
                title="Add Team Member"
                open={isAddDrawerOpen}
                onClose={closeAddDrawer}
                size={380}
                extra={
                    <Space>
                        <Button onClick={closeAddDrawer}>Cancel</Button>
                        <Button type="primary" onClick={handleAddMember} loading={isSubmittingMember}>
                            Add
                        </Button>
                    </Space>
                }
            >
                {addMemberError && (
                    <Alert type="error" title={addMemberError} showIcon style={{ marginBottom: 16 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={fieldLabelStyle}>Email</label>
                        <Input
                            value={newMember.user_email}
                            onChange={(e) => setNewMember((prev) => ({ ...prev, user_email: e.target.value }))}
                            placeholder="name@company.com"
                        />
                    </div>
                    <div>
                        <label style={fieldLabelStyle}>First Name</label>
                        <Input
                            value={newMember.user_first_name}
                            onChange={(e) => setNewMember((prev) => ({ ...prev, user_first_name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label style={fieldLabelStyle}>Last Name</label>
                        <Input
                            value={newMember.user_last_name}
                            onChange={(e) => setNewMember((prev) => ({ ...prev, user_last_name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label style={fieldLabelStyle}>Role</label>
                        <Radio.Group
                            value={newMember.user_role}
                            onChange={(e) => setNewMember((prev) => ({ ...prev, user_role: e.target.value }))}
                            options={[
                                { label: 'Admin', value: 'admin' },
                                { label: 'Member', value: 'member' },
                            ]}
                        />
                    </div>
                </div>
            </Drawer>
        </ConfigProvider>)
}
