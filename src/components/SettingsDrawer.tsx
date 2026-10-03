import { useState } from 'react';
import type React from 'react';
import { Alert, Button, Divider, Drawer, Input, message } from 'antd';
import useStore from '../store/store';
import { validatePasswordComplexity } from '../utils/password';
import { extractErrorMessage } from '../utils/api';
import type { AuthToken } from '../types/auth';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  authToken: AuthToken;
  onAuthChange: (token: AuthToken) => void;
}

const initCap = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose, authToken, onAuthChange }) => {
  const { updateProfile, changePassword } = useStore();

  // The parent (Header) remounts this component with a fresh `key` each time
  // Settings is opened, so these initial values are always in sync with the
  // latest token — no effect-based reset needed.
  const [firstName, setFirstName] = useState(authToken.decoded_token.user_first_name ?? '');
  const [lastName, setLastName] = useState(authToken.decoded_token.user_last_name ?? '');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const role = authToken.decoded_token.roles?.[0] ?? '';

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First and last name are required.');
      return;
    }

    setProfileError('');
    setIsSavingProfile(true);
    try {
      const freshToken = await updateProfile(authToken.access_token, {
        user_first_name: firstName.trim(),
        user_last_name: lastName.trim(),
      });
      onAuthChange(freshToken);
      message.success('Profile updated.');
    } catch (err) {
      setProfileError(extractErrorMessage(err, 'Something went wrong.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    const complexityError = validatePasswordComplexity(newPassword);
    if (complexityError) {
      setPasswordError(complexityError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordError('');
    setIsChangingPassword(true);
    try {
      await changePassword(authToken.access_token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      message.success('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(extractErrorMessage(err, 'Something went wrong.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Drawer title="Account Settings" open={open} onClose={onClose} size={380}>
      <h4 className="section-title" style={{ marginBottom: 12 }}>
        Profile
      </h4>
      <form onSubmit={handleSaveProfile}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={fieldLabelStyle}>Role</label>
            <Input value={initCap(role)} disabled />
          </div>
          <div>
            <label style={fieldLabelStyle}>First Name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label style={fieldLabelStyle}>Last Name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          {profileError && <Alert type="error" title={profileError} showIcon />}

          <Button type="primary" htmlType="submit" loading={isSavingProfile}>
            Save Changes
          </Button>
        </div>
      </form>

      <Divider />

      <h4 className="section-title" style={{ marginBottom: 12 }}>
        Change Password
      </h4>
      <form onSubmit={handleChangePassword}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={fieldLabelStyle}>Current Password</label>
            <Input.Password
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>New Password</label>
            <Input.Password
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Confirm New Password</label>
            <Input.Password
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {passwordError && <Alert type="error" title={passwordError} showIcon />}

          <Button type="primary" htmlType="submit" loading={isChangingPassword}>
            Change Password
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
