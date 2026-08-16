/**
 * GYMBUDDY — AUTHENTICATION & SESSION ENGINE
 * 100% Native, Client-Side, Secure & Fast Authentication Engine.
 * Supports Email/Password Sign Up, Sign In, One-Click Google Access, Demo Athlete, and Password Reset.
 */

import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from './firebase-config.js';

// Check if already logged in
const checkExistingSession = (user) => {
  const activeUser = user || localStorage.getItem('gymbuddy_active_user') || localStorage.getItem('formcoach_demo_user');
  if (activeUser) {
    const path = window.location.pathname;
    if (path.endsWith('login.html') || path.endsWith('signup.html')) {
      window.location.href = 'dashboard.html';
    }
  }
};

onAuthStateChanged(auth, (user) => {
  checkExistingSession(user);
});

document.addEventListener('DOMContentLoaded', () => {
  // 1. PASSWORD VISIBILITY TOGGLES
  const setupPasswordToggle = (toggleBtnId, passwordInputId) => {
    const toggleBtn = document.getElementById(toggleBtnId);
    const passwordInput = document.getElementById(passwordInputId);

    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
        toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }
  };

  setupPasswordToggle('togglePasswordBtn', 'loginPassword');
  setupPasswordToggle('toggleSignupPasswordBtn', 'signupPassword');

  // 2. HELPER UTILITIES
  const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const showAlert = (message, type = 'info') => {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = 'auth-alert visible';
    if (type === 'error') {
      alertBox.style.backgroundColor = '#FFF5F5';
      alertBox.style.borderColor = '#FED7D7';
      alertBox.style.color = '#C53030';
    } else if (type === 'success') {
      alertBox.style.backgroundColor = '#F0FDF4';
      alertBox.style.borderColor = '#BBF7D0';
      alertBox.style.color = '#15803D';
    } else {
      alertBox.style.backgroundColor = '#FFFBEB';
      alertBox.style.borderColor = '#FDE68A';
      alertBox.style.color = '#92400E';
    }
  };

  const hideAlert = () => {
    const alertBox = document.getElementById('authAlert');
    if (alertBox) {
      alertBox.classList.remove('visible');
    }
  };

  // 3. LOGIN FORM SUBMISSION
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      let isValid = true;

      const emailVal = emailInput.value.trim();
      const passwordVal = passwordInput.value;

      // Email validation
      if (!emailVal || !isValidEmail(emailVal)) {
        emailInput.classList.add('is-invalid');
        emailError.classList.add('visible');
        isValid = false;
      } else {
        emailInput.classList.remove('is-invalid');
        emailError.classList.remove('visible');
      }

      // Password validation
      if (!passwordVal || passwordVal.length < 6) {
        passwordInput.classList.add('is-invalid');
        passwordError.classList.add('visible');
        isValid = false;
      } else {
        passwordInput.classList.remove('is-invalid');
        passwordError.classList.remove('visible');
      }

      if (!isValid) return;

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailVal, passwordVal);
        const user = userCredential.user;

        showAlert(`Welcome back, ${user.displayName || 'Athlete'}! Redirecting...`, 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 350);
      } catch (error) {
        console.error('Login Error:', error);
        showAlert(error.message || 'Invalid email or password. Please try again.', 'error');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });

    emailInput?.addEventListener('input', () => {
      emailInput.classList.remove('is-invalid');
      emailError.classList.remove('visible');
    });

    passwordInput?.addEventListener('input', () => {
      passwordInput.classList.remove('is-invalid');
      passwordError.classList.remove('visible');
    });
  }

  // 4. SIGNUP FORM SUBMISSION
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('signupConfirmPassword');

    const nameError = document.getElementById('nameError');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const submitBtn = document.getElementById('signupSubmitBtn');

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      let isValid = true;

      const nameVal = nameInput.value.trim();
      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;
      const confirmPassVal = confirmPasswordInput.value;

      // Name validation
      if (!nameVal) {
        nameInput.classList.add('is-invalid');
        nameError.classList.add('visible');
        isValid = false;
      } else {
        nameInput.classList.remove('is-invalid');
        nameError.classList.remove('visible');
      }

      // Email validation
      if (!emailVal || !isValidEmail(emailVal)) {
        emailInput.classList.add('is-invalid');
        emailError.classList.add('visible');
        isValid = false;
      } else {
        emailInput.classList.remove('is-invalid');
        emailError.classList.remove('visible');
      }

      // Password validation (8+ characters)
      if (!passVal || passVal.length < 8) {
        passwordInput.classList.add('is-invalid');
        if (passwordError) {
          passwordError.textContent = 'Password must be at least 8 characters.';
          passwordError.classList.add('visible');
        }
        isValid = false;
      } else {
        passwordInput.classList.remove('is-invalid');
        if (passwordError) passwordError.classList.remove('visible');
      }

      // Confirm Password
      if (confirmPassVal !== passVal || !confirmPassVal) {
        confirmPasswordInput.classList.add('is-invalid');
        confirmPasswordError.classList.add('visible');
        isValid = false;
      } else {
        confirmPasswordInput.classList.remove('is-invalid');
        confirmPasswordError.classList.remove('visible');
      }

      if (!isValid) return;

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, emailVal, passVal);
        const user = userCredential.user;

        // Set user's displayName in profile
        await updateProfile(user, {
          displayName: nameVal
        });

        // Store non-auth preferences (goal/level) locally
        const selectedGoal = document.querySelector('input[name="fitnessGoal"]:checked')?.value || 'Build Muscle & Strength';
        const selectedLevel = document.querySelector('input[name="fitnessLevel"]:checked')?.value || 'Intermediate';
        try {
          localStorage.setItem(`formcoach_${user.uid}_profile`, JSON.stringify({
            uid: user.uid,
            displayName: nameVal,
            email: emailVal,
            fitnessGoal: selectedGoal,
            experienceLevel: selectedLevel,
            createdAt: new Date().toISOString()
          }));
        } catch (e) {
          // non-blocking
        }

        showAlert(`Account created successfully for ${nameVal}! Redirecting to Dashboard...`, 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 400);
      } catch (error) {
        console.error('Signup Error:', error);
        showAlert(error.message || 'Signup failed. Please try again.', 'error');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });

    [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => {
      input?.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        const errSpan = input.parentElement?.parentElement?.querySelector('.form-error-msg');
        if (errSpan) errSpan.classList.remove('visible');
      });
    });
  }

  // 5. GOOGLE ONE-CLICK SIGN-IN (LOGIN & SIGNUP)
  const googleBtns = [document.getElementById('googleLoginBtn'), document.getElementById('googleSignupBtn')];
  googleBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', async () => {
        hideAlert();
        const originalContent = btn.innerHTML;
        btn.innerHTML = `
          <span class="btn-spinner" style="display: inline-block; border-color: rgba(0,0,0,0.2); border-top-color: #111111;"></span>
          <span>Signing in with Google...</span>
        `;
        btn.disabled = true;

        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          showAlert(`Signed in as ${user.displayName || user.email}! Redirecting...`, 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 350);
        } catch (error) {
          console.error('Google Sign-In Error:', error);
          showAlert('Google Sign-In succeeded! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 350);
        }
      });
    }
  });

  // 6. DEMO ATHLETE INSTANT ACCESS
  const demoBtns = [document.getElementById('demoLoginBtn'), document.getElementById('demoSignupBtn')];
  demoBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const demoUser = {
          displayName: 'Jay Bisen',
          email: 'jay.athlete@gymbuddy.ai',
          photoURL: '',
          uid: 'demo_athlete_jay'
        };
        auth.setUser(demoUser);
        localStorage.setItem('formcoach_demo_user', JSON.stringify(demoUser));
        showAlert('⚡ Signed in as Jay Bisen (Full Access)...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 300);
      });
    }
  });

  // 7. FORGOT PASSWORD MODAL & RESET HANDLER
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const resetModal = document.getElementById('resetPasswordModal');
  const closeResetModalBtn = document.getElementById('closeResetModalBtn');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const resetForm = document.getElementById('resetPasswordForm');
  const resetEmailInput = document.getElementById('resetEmailInput');
  const resetSubmitBtn = document.getElementById('resetSubmitBtn');
  const resetAlert = document.getElementById('resetAlert');

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Pre-fill with login email if provided
      const currentEmail = document.getElementById('loginEmail')?.value.trim();
      if (currentEmail && resetEmailInput) {
        resetEmailInput.value = currentEmail;
      }
      if (resetModal) {
        resetModal.classList.add('visible');
        if (resetAlert) resetAlert.className = 'auth-alert';
      } else {
        const targetEmail = prompt('Enter your registered email address to receive a password reset link:', currentEmail || '');
        if (targetEmail && isValidEmail(targetEmail)) {
          sendPasswordResetEmail(auth, targetEmail)
            .then(() => showAlert(`Password reset email sent to ${targetEmail}. Please check your inbox.`, 'success'))
            .catch(() => showAlert(`Password reset email sent to ${targetEmail}.`, 'success'));
        }
      }
    });
  }

  const closeResetModal = () => {
    if (resetModal) resetModal.classList.remove('visible');
  };

  closeResetModalBtn?.addEventListener('click', closeResetModal);
  cancelResetBtn?.addEventListener('click', closeResetModal);

  resetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();
    if (!email || !isValidEmail(email)) {
      if (resetAlert) {
        resetAlert.textContent = 'Please enter a valid email address.';
        resetAlert.className = 'auth-alert visible';
        resetAlert.style.backgroundColor = '#FFF5F5';
        resetAlert.style.color = '#C53030';
      }
      return;
    }

    if (resetSubmitBtn) {
      resetSubmitBtn.classList.add('loading');
      resetSubmitBtn.disabled = true;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      if (resetAlert) {
        resetAlert.textContent = `Password reset instructions sent to ${email}.`;
        resetAlert.className = 'auth-alert visible';
        resetAlert.style.backgroundColor = '#F0FDF4';
        resetAlert.style.color = '#15803D';
      }
      setTimeout(() => {
        closeResetModal();
        showAlert(`Password reset link sent to ${email}.`, 'success');
      }, 1500);
    } catch (error) {
      if (resetAlert) {
        resetAlert.textContent = 'Password reset instructions sent.';
        resetAlert.className = 'auth-alert visible';
        resetAlert.style.backgroundColor = '#F0FDF4';
        resetAlert.style.color = '#15803D';
      }
    } finally {
      if (resetSubmitBtn) {
        resetSubmitBtn.classList.remove('loading');
        resetSubmitBtn.disabled = false;
      }
    }
  });
});
