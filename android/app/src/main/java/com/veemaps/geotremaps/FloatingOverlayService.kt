package com.veemaps.geotremaps

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

/**
 * Foreground Service for VeeMaps Floating Overlay Widget.
 * Displays a draggable floating bubble on top of other apps, allowing quick
 * location capture with custom/preset radius, along with speed-dial controls.
 */
class FloatingOverlayService : Service(), LocationListener {

    companion object {
        const val ACTION_START = "com.veemaps.geotremaps.ACTION_START_OVERLAY"
        const val ACTION_STOP = "com.veemaps.geotremaps.ACTION_STOP_OVERLAY"
        const val EXTRA_CURRENT_ORIGINS = "extra_current_origins"
        const val CHANNEL_ID = "veemaps_overlay_channel"
        const val NOTIFICATION_ID = 2001
        const val PREFS_NAME = "veemaps_overlay_prefs"
        const val KEY_PENDING_EVENTS = "pending_overlay_events"
        const val KEY_CACHED_ORIGINS = "cached_origins"

        var isRunning = false
            private set

        fun addPendingEvent(context: Context, eventJson: JSONObject) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getString(KEY_PENDING_EVENTS, "[]") ?: "[]"
            try {
                val array = JSONArray(current)
                array.put(eventJson)
                prefs.edit().putString(KEY_PENDING_EVENTS, array.toString()).apply()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun getAndClearPendingEvents(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getString(KEY_PENDING_EVENTS, "[]") ?: "[]"
            prefs.edit().putString(KEY_PENDING_EVENTS, "[]").apply()
            return current
        }
    }

    private lateinit var windowManager: WindowManager
    private lateinit var rootView: FrameLayout
    private lateinit var bubbleView: FrameLayout
    private lateinit var speedDialMenu: LinearLayout
    private lateinit var quickAddCard: LinearLayout
    private lateinit var modifyCard: LinearLayout
    private lateinit var windowParams: WindowManager.LayoutParams

    private var locationManager: LocationManager? = null
    private var lastKnownLocation: Location? = null

    // Touch tracking
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var touchStartTime = 0L
    private var isLongPress = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val longPressRunnable = Runnable {
        isLongPress = true
        vibrate(50)
        toggleSpeedDial()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        setupForegroundNotification()
        initLocationListener()
        buildOverlayViews()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Cache existing origins if passed
        val originsJson = intent?.getStringExtra(EXTRA_CURRENT_ORIGINS)
        if (!originsJson.isNullOrBlank()) {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_CACHED_ORIGINS, originsJson)
                .apply()
        }

        return START_STICKY
    }

    private fun setupForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "VeeMaps Superposición",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Burbuja flotante activa sobre otras aplicaciones"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpenApp = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, FloatingOverlayService::class.java).apply {
            action = ACTION_STOP
        }
        val pendingStop = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VeeMaps Superposición Flotante")
            .setContentText("Toca la burbuja para añadir origen con radio GPS")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingOpenApp)
            .addAction(0, "Cerrar", pendingStop)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun initLocationListener() {
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            for (p in providers) {
                if (locationManager?.isProviderEnabled(p) == true) {
                    val loc = locationManager?.getLastKnownLocation(p)
                    if (loc != null && (lastKnownLocation == null || loc.accuracy < lastKnownLocation!!.accuracy)) {
                        lastKnownLocation = loc
                    }
                }
            }

            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000L, 2f, this)
            }
            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000L, 5f, this)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun dp(value: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

    private fun buildOverlayViews() {
        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        windowParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(20f)
            y = dp(150f)
        }

        rootView = FrameLayout(this).apply {
            clipChildren = false
            clipToPadding = false
        }

        // 1. Build Speed Dial Vertical Menu (Initially GONE)
        speedDialMenu = buildSpeedDialMenu()
        rootView.addView(speedDialMenu)

        // 2. Build Quick Add Card (Initially GONE)
        quickAddCard = buildQuickAddCard()
        rootView.addView(quickAddCard)

        // 3. Build Modify Card (Initially GONE)
        modifyCard = buildModifyCard()
        rootView.addView(modifyCard)

        // 4. Build Floating Bubble (Always visible)
        bubbleView = buildBubbleView()
        rootView.addView(bubbleView)

        setupTouchListener()

        windowManager.addView(rootView, windowParams)
    }

    private fun buildBubbleView(): FrameLayout {
        val bubbleSize = dp(58f)
        val bubble = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(bubbleSize, bubbleSize).apply {
                gravity = Gravity.BOTTOM or Gravity.START
            }
            elevation = dp(8f).toFloat()

            // Outer circular shape with dark navy background & cyan neon border
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xEE0E1726.toInt()) // Sleek dark navy
                setStroke(dp(2.5f), 0xFF00E5FF.toInt()) // Vibrant cyan
            }
        }

        // Inner glowing compass icon / pin
        val icon = TextView(this).apply {
            text = "📍"
            textSize = 24f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        bubble.addView(icon)

        return bubble
    }

    private fun buildSpeedDialMenu(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.START
                bottomMargin = dp(68f) // Sits vertically above the bubble
            }

            // Button 1: Close Superposition
            addView(createSpeedDialItem("✕", "Cerrar", 0xFFEF4444.toInt()) {
                vibrate(30)
                stopSelf()
            })

            // Button 2: Delete Origin
            addView(createSpeedDialItem("🗑️", "Eliminar Origen", 0xFFDC2626.toInt()) {
                vibrate(40)
                handleDeleteLastOrigin()
            })

            // Button 3: Modify Origin
            addView(createSpeedDialItem("✏️", "Modificar Origen", 0xFFF59E0B.toInt()) {
                vibrate(30)
                speedDialMenu.visibility = View.GONE
                showModifyDialog()
            })
        }
    }

    private fun createSpeedDialItem(icon: String, text: String, accentColor: Int, onClick: () -> Unit): LinearLayout {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), dp(4f), dp(8f), dp(4f))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(8f)
            }
        }

        // Label pill
        val label = TextView(this).apply {
            this.text = text
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            setPadding(dp(10f), dp(5f), dp(10f), dp(5f))
            background = GradientDrawable().apply {
                setColor(0xEE111827.toInt())
                cornerRadius = dp(8f).toFloat()
                setStroke(dp(1f), 0x44FFFFFF)
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                rightMargin = dp(8f)
            }
        }

        // Circular Icon button
        val itemSize = dp(42f)
        val iconBtn = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(itemSize, itemSize)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xF01E293B.toInt())
                setStroke(dp(1.5f), accentColor)
            }
            elevation = dp(4f).toFloat()

            val iconText = TextView(context).apply {
                this.text = icon
                textSize = 16f
                gravity = Gravity.CENTER
                setTextColor(accentColor)
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            addView(iconText)

            setOnClickListener { onClick() }
        }

        row.addView(label)
        row.addView(iconBtn)
        row.setOnClickListener { onClick() }
        return row
    }

    private fun buildQuickAddCard(): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setPadding(dp(14f), dp(12f), dp(14f), dp(12f))
            elevation = dp(12f).toFloat()

            background = GradientDrawable().apply {
                setColor(0xF20F172A.toInt()) // Dark slate glassmorphism
                cornerRadius = dp(16f).toFloat()
                setStroke(dp(1.5f), 0xFF38BDF8.toInt()) // Cyan border
            }

            layoutParams = FrameLayout.LayoutParams(dp(240f), FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.BOTTOM or Gravity.START
                leftMargin = dp(68f) // Offset to the right of the bubble
            }
        }

        // Title
        val title = TextView(this).apply {
            text = "📍 Añadir Origen Actual"
            setTextColor(0xFF38BDF8.toInt())
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
        }
        card.addView(title)

        // Subtitle
        val sub = TextView(this).apply {
            text = "Radio de cobertura:"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, dp(2f), 0, dp(6f))
        }
        card.addView(sub)

        // Input row
        val inputRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val inputRadius = EditText(this).apply {
            id = View.generateViewId()
            setText("500")
            inputType = InputType.TYPE_CLASS_NUMBER
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 15f
            setPadding(dp(10f), dp(6f), dp(10f), dp(6f))
            background = GradientDrawable().apply {
                setColor(0xFF1E293B.toInt())
                cornerRadius = dp(8f).toFloat()
                setStroke(dp(1f), 0xFF475569.toInt())
            }
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

            setOnFocusChangeListener { _, hasFocus ->
                setWindowFocusable(hasFocus)
            }
        }
        val unitLabel = TextView(this).apply {
            text = " m"
            setTextColor(0xFFCBD5E1.toInt())
            textSize = 13f
            setPadding(dp(6f), 0, dp(4f), 0)
        }
        inputRow.addView(inputRadius)
        inputRow.addView(unitLabel)
        card.addView(inputRow)

        // Quick Preset Chips (100m, 500m, 1km, 3km)
        val chipsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(8f), 0, dp(8f))
        }

        val presets = listOf("100m" to "100", "500m" to "500", "1km" to "1000", "3km" to "3000")
        for ((label, valMeters) in presets) {
            val chip = Button(this).apply {
                text = label
                textSize = 11f
                setTextColor(0xFF38BDF8.toInt())
                background = GradientDrawable().apply {
                    setColor(0xFF1E293B.toInt())
                    cornerRadius = dp(6f).toFloat()
                    setStroke(dp(1f), 0xFF334155.toInt())
                }
                layoutParams = LinearLayout.LayoutParams(0, dp(30f), 1f).apply {
                    setMargins(dp(2f), 0, dp(2f), 0)
                }
                setOnClickListener {
                    inputRadius.setText(valMeters)
                    vibrate(15)
                }
            }
            chipsRow.addView(chip)
        }
        card.addView(chipsRow)

        // Action Buttons Row
        val actionsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            setPadding(0, dp(4f), 0, 0)
        }

        val btnCancel = Button(this).apply {
            text = "Cancelar"
            textSize = 12f
            setTextColor(0xFF94A3B8.toInt())
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
                setWindowFocusable(false)
                card.visibility = View.GONE
            }
        }

        val btnSave = Button(this).apply {
            text = "✓ Guardar"
            textSize = 12f
            setTextColor(0xFFFFFFFF.toInt())
            setTypeface(null, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(0xFF10B981.toInt()) // Emerald green
                cornerRadius = dp(8f).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(34f)
            ).apply {
                leftMargin = dp(8f)
            }
            setOnClickListener {
                val radiusValue = inputRadius.text.toString().toDoubleOrNull() ?: 500.0
                saveNewOriginAtCurrentLocation(radiusValue)
                setWindowFocusable(false)
                card.visibility = View.GONE
            }
        }

        actionsRow.addView(btnCancel)
        actionsRow.addView(btnSave)
        card.addView(actionsRow)

        return card
    }

    private fun buildModifyCard(): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setPadding(dp(14f), dp(12f), dp(14f), dp(12f))
            elevation = dp(12f).toFloat()

            background = GradientDrawable().apply {
                setColor(0xF20F172A.toInt())
                cornerRadius = dp(16f).toFloat()
                setStroke(dp(1.5f), 0xFFF59E0B.toInt()) // Amber border
            }

            layoutParams = FrameLayout.LayoutParams(dp(240f), FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.BOTTOM or Gravity.START
                leftMargin = dp(68f)
            }
        }

        val title = TextView(this).apply {
            text = "✏️ Modificar Origen"
            setTextColor(0xFFF59E0B.toInt())
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
        }
        card.addView(title)

        val sub = TextView(this).apply {
            text = "Nuevo radio para el origen actual:"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, dp(2f), 0, dp(6f))
        }
        card.addView(sub)

        val inputRadius = EditText(this).apply {
            setText("500")
            inputType = InputType.TYPE_CLASS_NUMBER
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 15f
            setPadding(dp(10f), dp(6f), dp(10f), dp(6f))
            background = GradientDrawable().apply {
                setColor(0xFF1E293B.toInt())
                cornerRadius = dp(8f).toFloat()
                setStroke(dp(1f), 0xFF475569.toInt())
            }
            setOnFocusChangeListener { _, hasFocus ->
                setWindowFocusable(hasFocus)
            }
        }
        card.addView(inputRadius)

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            setPadding(0, dp(8f), 0, 0)
        }

        val btnCancel = Button(this).apply {
            text = "Cancelar"
            textSize = 12f
            setTextColor(0xFF94A3B8.toInt())
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
                setWindowFocusable(false)
                card.visibility = View.GONE
            }
        }

        val btnUpdate = Button(this).apply {
            text = "Actualizar"
            textSize = 12f
            setTextColor(0xFFFFFFFF.toInt())
            setTypeface(null, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(0xFFF59E0B.toInt())
                cornerRadius = dp(8f).toFloat()
            }
            setOnClickListener {
                val newRadius = inputRadius.text.toString().toDoubleOrNull() ?: 500.0
                handleModifyLastOrigin(newRadius)
                setWindowFocusable(false)
                card.visibility = View.GONE
            }
        }

        actions.addView(btnCancel)
        actions.addView(btnUpdate)
        card.addView(actions)

        return card
    }

    private fun setWindowFocusable(focusable: Boolean) {
        if (focusable) {
            windowParams.flags = windowParams.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
        } else {
            windowParams.flags = windowParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        }
        windowManager.updateViewLayout(rootView, windowParams)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupTouchListener() {
        bubbleView.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = windowParams.x
                    initialY = windowParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    touchStartTime = System.currentTimeMillis()
                    isLongPress = false
                    mainHandler.postDelayed(longPressRunnable, 450)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = abs(event.rawX - initialTouchX)
                    val dy = abs(event.rawY - initialTouchY)
                    if (dx > dp(10f) || dy > dp(10f)) {
                        mainHandler.removeCallbacks(longPressRunnable)
                    }
                    windowParams.x = initialX + (event.rawX - initialTouchX).toInt()
                    windowParams.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager.updateViewLayout(rootView, windowParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    mainHandler.removeCallbacks(longPressRunnable)
                    val duration = System.currentTimeMillis() - touchStartTime
                    val dx = abs(event.rawX - initialTouchX)
                    val dy = abs(event.rawY - initialTouchY)

                    if (!isLongPress && duration < 450 && dx < dp(12f) && dy < dp(12f)) {
                        onBubbleSingleTap()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun onBubbleSingleTap() {
        vibrate(25)
        if (speedDialMenu.visibility == View.VISIBLE) {
            speedDialMenu.visibility = View.GONE
            return
        }
        if (modifyCard.visibility == View.VISIBLE) {
            modifyCard.visibility = View.GONE
            setWindowFocusable(false)
            return
        }

        if (quickAddCard.visibility == View.VISIBLE) {
            quickAddCard.visibility = View.GONE
            setWindowFocusable(false)
        } else {
            quickAddCard.visibility = View.VISIBLE
        }
    }

    private fun toggleSpeedDial() {
        if (quickAddCard.visibility == View.VISIBLE) {
            quickAddCard.visibility = View.GONE
            setWindowFocusable(false)
        }
        if (modifyCard.visibility == View.VISIBLE) {
            modifyCard.visibility = View.GONE
            setWindowFocusable(false)
        }

        speedDialMenu.visibility = if (speedDialMenu.visibility == View.VISIBLE) View.GONE else View.VISIBLE
    }

    private fun showModifyDialog() {
        quickAddCard.visibility = View.GONE
        modifyCard.visibility = View.VISIBLE
    }

    private fun saveNewOriginAtCurrentLocation(radiusMeters: Double) {
        val loc = lastKnownLocation
        if (loc == null) {
            Toast.makeText(this, "⚠️ Esperando señal GPS...", Toast.LENGTH_SHORT).show()
            return
        }

        val newId = "origin_overlay_${System.currentTimeMillis()}"
        val originObj = JSONObject().apply {
            put("id", newId)
            put("label", "Origen (Flotante)")
            put("lat", loc.latitude)
            put("lng", loc.longitude)
            put("radius", radiusMeters)
            put("timestamp", System.currentTimeMillis())
        }

        val event = JSONObject().apply {
            put("type", "ADD_ORIGIN")
            put("origin", originObj)
        }

        addPendingEvent(this, event)
        notifyMainActivityOfEvent("ADD_ORIGIN", originObj.toString())

        vibrateSuccessHaptic()
        Toast.makeText(this, "✓ Origen añadido con radio de ${radiusMeters.toInt()}m", Toast.LENGTH_SHORT).show()
    }

    private fun handleDeleteLastOrigin() {
        val event = JSONObject().apply {
            put("type", "DELETE_LAST_ORIGIN")
            put("timestamp", System.currentTimeMillis())
        }
        addPendingEvent(this, event)
        notifyMainActivityOfEvent("DELETE_LAST_ORIGIN", "{}")

        vibrate(40)
        Toast.makeText(this, "🗑️ Último origen eliminado", Toast.LENGTH_SHORT).show()
        speedDialMenu.visibility = View.GONE
    }

    private fun handleModifyLastOrigin(newRadius: Double) {
        val event = JSONObject().apply {
            put("type", "MODIFY_LAST_ORIGIN")
            put("radius", newRadius)
            put("timestamp", System.currentTimeMillis())
        }
        addPendingEvent(this, event)
        notifyMainActivityOfEvent("MODIFY_LAST_ORIGIN", "{\"radius\": $newRadius}")

        vibrate(30)
        Toast.makeText(this, "✏️ Radio actualizado a ${newRadius.toInt()}m", Toast.LENGTH_SHORT).show()
    }

    private fun notifyMainActivityOfEvent(eventType: String, dataJson: String) {
        MainActivity.activeInstance?.let { activity ->
            activity.runOnUiThread {
                val js = "if (window.onOverlayEventReceived) { window.onOverlayEventReceived('$eventType', $dataJson); }"
                activity.executeJavascript(js)
            }
        }
    }

    private fun vibrate(ms: Long) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(ms)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibrateSuccessHaptic() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val timings = longArrayOf(0, 40, 50, 60)
                val amplitudes = intArrayOf(0, 150, 0, 255)
                vibrator?.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(longArrayOf(0, 40, 50, 60), -1)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onLocationChanged(location: Location) {
        lastKnownLocation = location
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        locationManager?.removeUpdates(this)
        if (::windowManager.isInitialized && ::rootView.isInitialized) {
            try {
                windowManager.removeView(rootView)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
