package io.nahhasio.client.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object DesktopPalette {
    val canvas = Color(0xFF17191C)
    val sidebar = Color(0xFF202226)
    val surface = Color(0xFF292C31)
    val elevated = Color(0xFF34383F)
    val text = Color(0xFFF0F1F3)
    val muted = Color(0xFFA2A7B0)
    val border = Color(0xFF3B3F46)
}

private val arabic = FontFamily(
    Font("fonts/IBMPlexSansArabic-Regular.ttf", FontWeight.Normal),
    Font("fonts/IBMPlexSansArabic-SemiBold.ttf", FontWeight.SemiBold),
)

@Composable
fun DesktopTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = DesktopPalette.text, onPrimary = DesktopPalette.canvas,
            primaryContainer = DesktopPalette.elevated, onPrimaryContainer = DesktopPalette.text,
            secondary = DesktopPalette.muted, onSecondary = DesktopPalette.canvas,
            secondaryContainer = DesktopPalette.elevated, onSecondaryContainer = DesktopPalette.text,
            tertiary = DesktopPalette.text, background = DesktopPalette.canvas,
            onBackground = DesktopPalette.text, surface = DesktopPalette.sidebar,
            onSurface = DesktopPalette.text, surfaceVariant = DesktopPalette.surface,
            onSurfaceVariant = DesktopPalette.muted, outline = DesktopPalette.border,
            outlineVariant = DesktopPalette.border, surfaceTint = Color.Transparent,
            surfaceContainerLowest = DesktopPalette.canvas, surfaceContainerLow = DesktopPalette.sidebar,
            surfaceContainer = DesktopPalette.surface, surfaceContainerHigh = DesktopPalette.elevated,
            surfaceContainerHighest = DesktopPalette.elevated, surfaceDim = DesktopPalette.canvas,
            surfaceBright = DesktopPalette.elevated, inverseSurface = DesktopPalette.text,
            inverseOnSurface = DesktopPalette.canvas, inversePrimary = DesktopPalette.canvas,
        ),
        shapes = Shapes(
            extraSmall = RoundedCornerShape(5.dp), small = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(10.dp), large = RoundedCornerShape(12.dp),
            extraLarge = RoundedCornerShape(14.dp),
        ),
        typography = Typography(
            displaySmall = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 36.sp, lineHeight = 48.sp),
            headlineLarge = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 30.sp, lineHeight = 42.sp),
            headlineMedium = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 25.sp, lineHeight = 36.sp),
            titleLarge = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 29.sp),
            titleMedium = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 24.sp),
            bodyLarge = TextStyle(fontFamily = arabic, fontSize = 15.sp, lineHeight = 25.sp),
            bodyMedium = TextStyle(fontFamily = arabic, fontSize = 14.sp, lineHeight = 23.sp),
            bodySmall = TextStyle(fontFamily = arabic, fontSize = 12.sp, lineHeight = 20.sp),
            labelLarge = TextStyle(fontFamily = arabic, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 22.sp),
            labelMedium = TextStyle(fontFamily = arabic, fontSize = 12.sp, lineHeight = 20.sp),
            labelSmall = TextStyle(fontFamily = arabic, fontSize = 11.sp, lineHeight = 18.sp),
        ),
        content = content,
    )
}
