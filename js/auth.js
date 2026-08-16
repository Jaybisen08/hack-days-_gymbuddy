/**
 * FORMCOACH AI — FIREBASE AUTHENTICATION CONTROLLER
 * Pure Vanilla JavaScript ES Module integrating with Firebase Auth SDK v10.
 * Handles Sign In, Sign Up, Google OAuth, Password Reset, and input validations.
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

// Check if already logged in via Firebase or Demo Session
const checkExistingSession = (user) => {
  const demoUser = localStorage.getItem('formcoach_demo_user');
  if (user || demoUser) {
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

  const formatFirebaseError = (errorCode) => {
    switch (errorCode) {
      case 'auth/operation-not-allowed':
        return 'Google Sign-In is currently disabled in your Firebase Console. Please enable the Google provider under Authentication > Sign-in method, or sign in with Email & Password or Demo Athlete mode below.';
      case 'auth/unauthorized-domain':
        return `Domain "${window.location.hostname}" is not authorized for Google Sign-In in Firebase Console. Please add "${window.location.hostname}" under Firebase Console > Authentication > Settings > Authorized domains, or use Email & Password / Demo Mode below.`;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 8 characters with letters and numbers.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Access temporarily disabled due to many failed attempts. Please try again later or reset your password.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completing.';
      case 'auth/cancelled-popup-request':
        return 'Sign-in operation was cancelled.';
      case 'auth/popup-blocked':
        return 'Google sign-in popup was blocked by your browser. Please allow popups for this site.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet connection.';
      default:
        return `Authentication failed: ${errorCode?.replace('auth/', '').replace(/-/g, ' ') || 'Please try again.'}`;
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
        // Set persistence based on remember me
        const persistenceType = (rememberMeCheckbox && rememberMeCheckbox.checked)
          ? browserLocalPersistence
          : browserSessionPersistence;
        
        try {
          await setPersistence(auth, persistenceType);
        } catch (persError) {
          console.warn('Persistence configuration note:', persError);
        }

        const userCredential = await signInWithEmailAndPassword(auth, emailVal, passwordVal);
        const user = userCredential.user;

        showAlert(`Welcome back, ${user.displayName || 'Athlete'}! Redirecting...`, 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 400);
      } catch (error) {
        console.error('Firebase Login Error:', error);
        showAlert(formatFirebaseError(error.code), 'error');
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

        // Set user's displayName in Firebase Auth profile
        await updateProfile(user, {
          displayName: nameVal
        });

        // Store non-auth preferences (goal/level) locally if desired for personalization
        const selectedGoal = document.querySelector('input[name="fitnessGoal"]:checked')?.value || 'Build Strength';
        const selectedLevel = document.querySelector('input[name="fitnessLevel"]:checked')?.value || 'Intermediate';
        try {
          localStorage.setItem('formcoachPreferences', JSON.stringify({
            goal: selectedGoal,
            level: selectedLevel
          }));
        } catch (e) {
          // non-blocking
        }

        showAlert(`Account created successfully for ${nameVal}! Redirecting to Dashboard...`, 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      } catch (error) {
        console.error('Firebase Signup Error:', error);
        showAlert(formatFirebaseError(error.code), 'error');
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

  // 5. GOOGLE OAUTH SIGN-IN (LOGIN & SIGNUP)
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
          }, 400);
        } catch (error) {
          console.error('Google Sign-In Error:', error);
          if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed') {
            showAuthSetupModal(error.code);
          } else {
            showAlert(formatFirebaseError(error.code), 'error');
          }
          btn.innerHTML = originalContent;
          btn.disabled = false;
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
          uid: 'demo_athlete_' + Date.now()
        };
        localStorage.setItem('formcoach_demo_user', JSON.stringify(demoUser));
        showAlert('Signing in as Demo Athlete (Full Access)...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 350);
      });
    }
  });

  // 7. FIREBASE AUTH SETUP / DOMAIN HELPER MODAL
  const domainModal = document.getElementById('unauthorizedDomainModal');
  const domainModalTitle = document.getElementById('domainModalTitle');
  const domainModalDesc = document.getElementById('domainModalDesc');
  const domainCopySection = document.getElementById('domainCopySection');
  const stepsHeaderTitle = document.getElementById('stepsHeaderTitle');
  const stepsList = document.getElementById('stepsList');
  const closeDomainModalBtn = document.getElementById('closeDomainModalBtn');
  const dismissDomainModalBtn = document.getElementById('dismissDomainModalBtn');
  const domainHostDisplay = document.getElementById('domainHostDisplay');
  const copyDomainBtn = document.getElementById('copyDomainBtn');
  const copyDomainFeedback = document.getElementById('copyDomainFeedback');
  const demoModalBtn = document.getElementById('demoFromModalBtn');

  const showAuthSetupModal = (errorCode) => {
    if (domainHostDisplay) {
      domainHostDisplay.textContent = window.location.hostname;
    }

    if (errorCode === 'auth/operation-not-allowed') {
      if (domainModalTitle) domainModalTitle.textContent = 'Enable Google Sign-In';
      if (domainModalDesc) {
        domainModalDesc.textContent = 'Google Sign-In is not enabled yet in your Firebase Project console.';
      }
      if (domainCopySection) domainCopySection.style.display = 'none';
      if (stepsHeaderTitle) stepsHeaderTitle.textContent = 'How to enable Google Sign-In in Firebase:';
      if (stepsList) {
        stepsList.innerHTML = `
          <li>Open your <strong style="color: #111111;">Firebase Console</strong> &gt; <strong style="color: #111111;">Authentication</strong> &gt; <strong style="color: #111111;">Sign-in method</strong>.</li>
          <li>Click on <strong style="color: #111111;">Google</strong> in the provider list.</li>
          <li>Toggle the <strong style="color: #111111;">Enable</strong> switch to ON.</li>
          <li>Select your support email and click <strong style="color: #111111;">Save</strong>.</li>
        `;
      }
    } else {
      // Default or unauthorized-domain
      if (domainModalTitle) domainModalTitle.textContent = 'Firebase Domain Setup';
      if (domainModalDesc) {
        domainModalDesc.textContent = 'Google Sign-In requires your current preview domain to be listed in Firebase Authorized Domains.';
      }
      if (domainCopySection) domainCopySection.style.display = 'block';
      if (stepsHeaderTitle) stepsHeaderTitle.textContent = 'Quick Fix in Firebase Console:';
      if (stepsList) {
        stepsList.innerHTML = `
          <li>Go to <strong style="color: #111111;">Authentication &gt; Settings</strong>.</li>
          <li>Scroll to <strong style="color: #111111;">Authorized domains</strong>.</li>
          <li>Click <strong style="color: #111111;">Add domain</strong> and paste your copied domain.</li>
        `;
      }
    }

    if (domainModal) {
      domainModal.classList.add('visible');
    } else {
      showAlert(formatFirebaseError(errorCode), 'error');
    }
  };

  const closeDomainModal = () => {
    if (domainModal) domainModal.classList.remove('visible');
  };

  closeDomainModalBtn?.addEventListener('click', closeDomainModal);
  dismissDomainModalBtn?.addEventListener('click', closeDomainModal);

  if (copyDomainBtn) {
    copyDomainBtn.addEventListener('click', () => {
      const host = window.location.hostname;
      navigator.clipboard.writeText(host).then(() => {
        if (copyDomainFeedback) {
          copyDomainFeedback.textContent = '✓ Copied to clipboard!';
          copyDomainFeedback.style.display = 'inline';
          setTimeout(() => {
            copyDomainFeedback.style.display = 'none';
          }, 2500);
        }
      }).catch(() => {
        if (copyDomainFeedback) {
          copyDomainFeedback.textContent = `Select and copy: ${host}`;
          copyDomainFeedback.style.display = 'inline';
        }
      });
    });
  }

  if (demoModalBtn) {
    demoModalBtn.addEventListener('click', () => {
      const demoUser = {
        displayName: 'Jay Bisen',
        email: 'jay.athlete@gymbuddy.ai',
        photoURL: '',
        uid: 'demo_athlete_' + Date.now()
      };
      localStorage.setItem('formcoach_demo_user', JSON.stringify(demoUser));
      closeDomainModal();
      showAlert('Continuing with Demo Athlete access...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 300);
    });
  }

  // 6. FORGOT PASSWORD MODAL & RESET HANDLER
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
        // Fallback prompt if modal element isn't in DOM
        const targetEmail = prompt('Enter your registered email address to receive a password reset link:', currentEmail || '');
        if (targetEmail && isValidEmail(targetEmail)) {
          sendPasswordResetEmail(auth, targetEmail)
            .then(() => showAlert(`Password reset email sent to ${targetEmail}. Please check your inbox.`, 'success'))
            .catch((err) => showAlert(formatFirebaseError(err.code), 'error'));
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
        resetAlert.textContent = `Password reset link sent to ${email}. Check your inbox or spam folder.`;
        resetAlert.className = 'auth-alert visible';
        resetAlert.style.backgroundColor = '#F0FDF4';
        resetAlert.style.color = '#15803D';
      }
      setTimeout(() => {
        closeResetModal();
        showAlert(`Password reset email sent to ${email}.`, 'success');
      }, 2500);
    } catch (error) {
      console.error('Password Reset Error:', error);
      if (resetAlert) {
        resetAlert.textContent = formatFirebaseError(error.code);
        resetAlert.className = 'auth-alert visible';
        resetAlert.style.backgroundColor = '#FFF5F5';
        resetAlert.style.color = '#C53030';
      }
    } finally {
      if (resetSubmitBtn) {
        resetSubmitBtn.classList.remove('loading');
        resetSubmitBtn.disabled = false;
      }
    }
  });
});
