package io.nahhasio.client.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.nahhasio.client.ui.*

@Composable
fun LoginScreen(busy: Boolean, error: String?, onLogin: (String, String, String) -> Unit) {
    var server by remember { mutableStateOf("http://127.0.0.1:23103") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Text("نحاسيو", style = MaterialTheme.typography.displaySmall)
        Surface(color = DesktopPalette.sidebar, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, DesktopPalette.border)) {
            Column(Modifier.widthIn(max = 400.dp).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text("أهلاً بعودتك", style = MaterialTheme.typography.headlineMedium)
                Text("اتصل بخادمك لتصفح المكتبة.", color = DesktopPalette.muted)
                LoginField("الخادم") { DesktopInput(server, { server = it }, "عنوان الخادم", Modifier.fillMaxWidth(), enabled = !busy) }
                LoginField("الحساب") { DesktopInput(email, { email = it }, "البريد الإلكتروني", Modifier.fillMaxWidth(), enabled = !busy) }
                LoginField("كلمة المرور") { DesktopInput(password, { password = it }, "كلمة المرور", Modifier.fillMaxWidth(), secret = true, enabled = !busy) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                DesktopButton(if (busy) "جارٍ الاتصال…" else "دخول إلى المكتبة", { val value = password; password = ""; onLogin(server, email, value) }, Modifier.fillMaxWidth(), enabled = !busy && email.isNotBlank() && password.isNotBlank(), primary = true)
            }
        }
        Text("مكتبتك الخاصة · على سطح المكتب", color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun LoginField(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = DesktopPalette.muted)
        content()
    }
}
