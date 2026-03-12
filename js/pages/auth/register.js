

        // =====================================================
        // VALIDATION STATE
        // =====================================================
        const validation = {
            email: false,
            username: false,
            displayName: false,
            password: false,
            confirmPassword: false
        };
        
        // Common weak passwords
        const commonPasswords = [
            'password', '12345678', '123456789', 'qwerty123', 'abc12345',
            'password1', 'iloveyou', 'sunshine', 'princess', 'admin123',
            'welcome1', 'monkey12', 'dragon12', 'master12', 'login123',
            'letmein1', 'qwertyui', 'asdfghjk', 'zxcvbnm1', 'football',
            'baseball', 'michael1', 'shadow12', 'ashley12', 'jennifer',
            '1234567890', 'computer', 'superman', 'batman12', 'trustno1'
        ];
        
        // =====================================================
        // EMAIL VALIDATION
        // =====================================================
        function validateEmail() {
            const email = document.getElementById('email').value.trim();
            const input = document.getElementById('email');
            const icon = document.getElementById('emailIcon');
            const error = document.getElementById('emailError');
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email === '') {
                input.classList.remove('valid', 'error');
                icon.textContent = '';
                error.classList.remove('show');
                validation.email = false;
            } else if (emailRegex.test(email)) {
                input.classList.remove('error');
                input.classList.add('valid');
                icon.textContent = '✓';
                icon.style.color = '#4caf50';
                error.classList.remove('show');
                validation.email = true;
            } else {
                input.classList.remove('valid');
                input.classList.add('error');
                icon.textContent = '✗';
                icon.style.color = '#f44336';
                error.classList.add('show');
                validation.email = false;
            }
            
            updateSubmitButton();
        }
        
        // =====================================================
        // USERNAME VALIDATION
        // =====================================================
        function validateUsername() {
            const username = document.getElementById('username').value.trim();
            const input = document.getElementById('username');
            const icon = document.getElementById('usernameIcon');
            const error = document.getElementById('usernameError');
            
            // Only allow alphanumeric, underscore, no spaces
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            
            if (username === '') {
                input.classList.remove('valid', 'error');
                icon.textContent = '';
                error.classList.remove('show');
                validation.username = false;
            } else if (username.length >= 1 && usernameRegex.test(username)) {
                input.classList.remove('error');
                input.classList.add('valid');
                icon.textContent = '✓';
                icon.style.color = '#4caf50';
                error.classList.remove('show');
                validation.username = true;
            } else {
                input.classList.remove('valid');
                input.classList.add('error');
                icon.textContent = '✗';
                icon.style.color = '#f44336';
                error.textContent = 'Username ต้องเป็นตัวอักษร ตัวเลข หรือ _ เท่านั้น';
                error.classList.add('show');
                validation.username = false;
            }
            
            updateSubmitButton();
        }
        
        // =====================================================
        // DISPLAY NAME VALIDATION
        // =====================================================
        function validateDisplayName() {
            const displayName = document.getElementById('displayName').value.trim();
            const input = document.getElementById('displayName');
            const icon = document.getElementById('displayNameIcon');
            const error = document.getElementById('displayNameError');
            
            if (displayName === '') {
                input.classList.remove('valid', 'error');
                icon.textContent = '';
                error.classList.remove('show');
                validation.displayName = false;
            } else if (displayName.length >= 1) {
                input.classList.remove('error');
                input.classList.add('valid');
                icon.textContent = '✓';
                icon.style.color = '#4caf50';
                error.classList.remove('show');
                validation.displayName = true;
            } else {
                input.classList.remove('valid');
                input.classList.add('error');
                icon.textContent = '✗';
                icon.style.color = '#f44336';
                error.classList.add('show');
                validation.displayName = false;
            }
            
            updateSubmitButton();
        }
        
        // =====================================================
        // PASSWORD VALIDATION
        // =====================================================
        function validatePassword() {
            const password = document.getElementById('password').value;
            const input = document.getElementById('password');
            const icon = document.getElementById('passwordIcon');
            
            // Check individual rules
            const hasLength = password.length >= 8;
            const hasNumber = /\d/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasUppercase = /[A-Z]/.test(password);
            const isNotCommon = !commonPasswords.includes(password.toLowerCase());
            
            // Update rule indicators
            updateRule('rule-length', hasLength);
            updateRule('rule-number', hasNumber);
            updateRule('rule-lowercase', hasLowercase);
            updateRule('rule-uppercase', hasUppercase);
            updateRule('rule-notcommon', password.length > 0 ? isNotCommon : false);
            
            // Calculate strength
            let strength = 0;
            if (hasLength) strength++;
            if (hasNumber) strength++;
            if (hasLowercase) strength++;
            if (hasUppercase) strength++;
            if (isNotCommon && password.length > 0) strength++;
            
            // Update strength bar
            updateStrengthBar(strength, password.length);
            
            // Set validation state
            const isValid = hasLength && hasNumber && hasLowercase && hasUppercase && isNotCommon;
            
            if (password === '') {
                input.classList.remove('valid', 'error');
                icon.textContent = '';
                validation.password = false;
            } else if (isValid) {
                input.classList.remove('error');
                input.classList.add('valid');
                icon.textContent = '✓';
                icon.style.color = '#4caf50';
                validation.password = true;
            } else {
                input.classList.remove('valid');
                input.classList.add('error');
                icon.textContent = '✗';
                icon.style.color = '#f44336';
                validation.password = false;
            }
            
            // Re-validate confirm password
            if (document.getElementById('confirmPassword').value) {
                validateConfirmPassword();
            }
            
            updateSubmitButton();
        }
        
        function updateRule(ruleId, passed) {
            const rule = document.getElementById(ruleId);
            if (passed) {
                rule.classList.add('passed');
            } else {
                rule.classList.remove('passed');
            }
        }
        
        function updateStrengthBar(strength, length) {
            const fill = document.getElementById('strengthFill');
            const text = document.getElementById('strengthText');
            
            fill.className = 'strength-fill';
            text.className = 'strength-text';
            
            if (length === 0) {
                fill.style.width = '0%';
                text.textContent = 'กรอกรหัสผ่าน';
            } else if (strength <= 2) {
                fill.classList.add('weak');
                text.classList.add('weak');
                text.textContent = '🔴 อ่อนมาก';
            } else if (strength === 3) {
                fill.classList.add('fair');
                text.classList.add('fair');
                text.textContent = '🟠 พอใช้';
            } else if (strength === 4) {
                fill.classList.add('good');
                text.classList.add('good');
                text.textContent = '🔵 ดี';
            } else {
                fill.classList.add('strong');
                text.classList.add('strong');
                text.textContent = '🟢 แข็งแรงมาก';
            }
        }
        
        // =====================================================
        // CONFIRM PASSWORD VALIDATION
        // =====================================================
        function validateConfirmPassword() {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const input = document.getElementById('confirmPassword');
            const icon = document.getElementById('confirmPasswordIcon');
            const error = document.getElementById('confirmPasswordError');
            
            if (confirmPassword === '') {
                input.classList.remove('valid', 'error');
                icon.textContent = '';
                error.classList.remove('show');
                validation.confirmPassword = false;
            } else if (confirmPassword === password && password.length > 0) {
                input.classList.remove('error');
                input.classList.add('valid');
                icon.textContent = '✓';
                icon.style.color = '#4caf50';
                error.classList.remove('show');
                validation.confirmPassword = true;
            } else {
                input.classList.remove('valid');
                input.classList.add('error');
                icon.textContent = '✗';
                icon.style.color = '#f44336';
                error.classList.add('show');
                validation.confirmPassword = false;
            }
            
            updateSubmitButton();
        }
        
        // =====================================================
        // SUBMIT BUTTON STATE
        // =====================================================
        function updateSubmitButton() {
            const btn = document.getElementById('submitBtn');
            const allValid = Object.values(validation).every(v => v === true);
            btn.disabled = !allValid;
        }
        
        // =====================================================
        // TOGGLE PASSWORD VISIBILITY
        // =====================================================
        function togglePassword(fieldId) {
            const input = document.getElementById(fieldId);
            const btn = input.parentElement.querySelector('.toggle-password');
            const icon = btn.querySelector('.material-icons');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = 'visibility_off';
            } else {
                input.type = 'password';
                icon.textContent = 'visibility';
            }
        }
        
 // =====================================================
// REGISTER WITH SUPABASE
// =====================================================
async function handleRegister(e) {
    e.preventDefault(); // ป้องกัน form refresh หน้า

    const btn = document.getElementById('submitBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    // ดึงค่าจาก input
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    const displayName = document.getElementById('displayName').value.trim();

    try {

        // ==========================================
        // STEP 1: สมัครสมาชิกในระบบ Auth
        // ==========================================
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        // ถ้าไม่มี user (กรณีเปิด email confirm)
        if (!data.user) {
            throw new Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
        }

        // ==========================================
// ตรวจสอบว่า username ซ้ำหรือไม่
// ==========================================
const { data: existingUser, error: checkError } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

if (checkError) throw checkError;

if (existingUser) {
    throw new Error("Username นี้ถูกใช้แล้ว กรุณาเลือกใหม่");
}


        // ==========================================
        // STEP 2: สร้าง profile เพิ่มใน table profiles
        // ==========================================
        const { error: profileError } = await supabaseClient
            .from("profiles")
            .insert([
                {
                    id: data.user.id, // ผูกกับ auth.users
                    username: username,
                    display_name: displayName,
                    email: email,
                    role: "user",        // ⭐ บังคับเป็น user เสมอ
                    status: "Active" 
                }
            ]);

        if (profileError) throw profileError;

        // ==========================================
        // SUCCESS
        // ==========================================
        showAlert("success", "✓", "สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);

    } catch (err) {

        showAlert("error", "✗", err.message);

        btn.classList.remove('loading');
        btn.disabled = false;
    }
}


            
            
        
        // =====================================================
        // ALERT HELPER
        // =====================================================
        function showAlert(type, icon, message) {
            const alert = document.getElementById('alert');
            const alertIcon = document.getElementById('alertIcon');
            const alertMessage = document.getElementById('alertMessage');
            
            alert.className = 'alert ' + type + ' show';
            alertIcon.textContent = icon;
            alertMessage.textContent = message;
            
            // Auto hide after 5 seconds for errors
            if (type === 'error') {
                setTimeout(function() {
                    alert.classList.remove('show');
                }, 5000);
            }
        }
  

