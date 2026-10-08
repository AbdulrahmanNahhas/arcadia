package io.nahhasio.client.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp

@Composable
fun DesktopInput(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier,
    secret: Boolean = false, enabled: Boolean = true, onSubmit: (() -> Unit)? = null) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = RoundedCornerShape(8.dp)
    BasicTextField(
        value, onChange, modifier.heightIn(min = 44.dp).clip(shape)
            .background(DesktopPalette.surface)
            .border(1.dp, if (focused) DesktopPalette.muted else DesktopPalette.border, shape)
            .semantics { contentDescription = placeholder },
        enabled = enabled, singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium.copy(color = DesktopPalette.text),
        cursorBrush = SolidColor(DesktopPalette.text),
        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(imeAction = if (onSubmit != null) ImeAction.Search else ImeAction.Default),
        keyboardActions = KeyboardActions(onSearch = { onSubmit?.invoke() }), interactionSource = interaction,
        decorationBox = { inner -> Box(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) Text(placeholder, color = DesktopPalette.muted, style = MaterialTheme.typography.bodyMedium)
            inner()
        } },
    )
}

@Composable
fun DesktopButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, primary: Boolean = false) {
    Button(onClick, modifier.heightIn(min = 40.dp), enabled = enabled, shape = RoundedCornerShape(8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (primary) DesktopPalette.text else DesktopPalette.surface,
            contentColor = if (primary) DesktopPalette.canvas else DesktopPalette.text,
        )) { Text(label) }
}

@Composable
fun DesktopChoice(label: String, value: String, choices: List<Pair<String, String>>, onChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        DesktopButton("$label  ${choices.find { it.first == value }?.second.orEmpty()}  ⌄", { expanded = true })
        DropdownMenu(expanded, { expanded = false }, containerColor = DesktopPalette.surface, shape = RoundedCornerShape(8.dp)) {
            choices.forEach { (key, name) -> DropdownMenuItem(text = { Text(name) }, onClick = { expanded = false; onChange(key) }) }
        }
    }
}
