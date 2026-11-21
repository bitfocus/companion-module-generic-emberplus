# Generic Ember Plus

- [Ember Plus](https://github.com/Lawo/ember-plus)

This is a generic ember plus module - successful use of this tool requires use and familiary with Ember Plus Viewer or a similar tool to identify the Ember Paths, and types, to be monitored and controlled.

The module only supports connection via TCP.

## Configuration

### Bonjour

Some devices support mDNS announcements according to the Ember Plus [specification](https://github.com/Lawo/ember-plus/blob/master/documentation/Ember%2B%20Service%20Discovery.pdf). The module should discover these, otherwise device IP and Port can be manually entered.

### Matrix Control

If you require matrix control, enter the ember path(s) here.

### Auto Take

Defines matrix behaviour.

### Paths to Monitor

Paths defined here will be registed with the host on initialisation, for use in actions and feedbacks. With **Parameter - Values** selected in Connection Variables they also get variables, and stream parameters among them with **Parameter - Streams**.

### Connection Variables

What the connection makes variables for:

- **Parameter - Values**: a variable for each parameter in use, whether configured above or used by an action or feedback, holding its value (an enumeration also gets an `_ENUM` variable holding its entry). Selected by default. Without it no parameter variables are made: the **Parameter Property** feedback gives a parameter's value to a button's local variable instead. This replaces the actions' **Auto Create Variable** option of earlier versions.
- **Parameter - Streams**: the same for stream parameters, such as audio meters, whose values the device sends many times a second. Off by default: a meter's values are only streamed while something uses them, and with this on every meter in use streams for its variable.
- **Matrix - Source Names**, **Matrix - Target Names** and **Matrix - Connections**: not used yet.

### Apply Formula and Factor to Parameter Variables

On, the variables of number parameters hold the value as it is displayed: by the parameter's formula, or else divided by its factor (a meter's formula, for instance, giving dB). Off, they hold the device's value.

### Streams

A stream parameter, such as an audio meter, is one the device sends values for many times a second, and only to a consumer that subscribed to it. The module subscribes while a feedback reads the parameter, or while it has a variable (Parameter - Streams), and unsubscribes once neither is so; an action doesn't keep a stream, as it reads the value when it runs. Feedbacks are rechecked, and variables set, at most every 10 ms. Stream values aren't recorded by the Action Recorder.

### Verbose Logs

Logs the Ember+ library's debug output, under the source `ember plus`, the full contents of each parameter as it is registered, and each value as it arrives. The module's own debug messages are always logged; Companion's log view shows them when its Debug level is selected.

## Paths

Central to the concept of ember+ is the address or path of the data element you wish to monitor or change. There are several ways to represent these in the module. Principally as decimals and strings. Regardless of the preferred method, one should be consistent - undesired behaviour can occur if the same path is specified in both methods across different actions and feedbacks.

- ### Decimal: 1.2.3.4

  Paths can always be entered as a decimal address (ie _1.2.3.4_). Forward slashes, as used in Ember+ Viewer, will be automatically substituted.

- ### String: Path.To.Ember.Node

  Paths can also be entered as a period seperated string. Such as _Path.To.Ember.Node_. These text paths can be found in Ember Plus Viewer, however they need to be reformatted to use period seperators rather than forward slashes. Note: ' ' & '#' characters used in ember paths are not supported for use in variables by companion, and will be replaced by '\_' in variable ids - the path can still be used in actions and feedbacks however.

- ### Decimal in Brackets: My Useful Ember Path [1.2.3.4]

  Any path field that contains brackets [] will just use the contents enclosed in the brackets as the path, if it is a valid decimal path. Thus you can copy paste any path with text and decimals from Ember Plus Viewer, and keep the text for readability or enter your own description _This is a very useful path[1.2.3.4]_. Only the path will be used for variable creation. This method cannot be used in config fields.

- ### Variables and Expressions

  Except in the module configuration, all of the above can be built from variables. The path dropdown of each action and feedback lists the registered paths, and also takes a path typed in. To build a path from variables, switch the field to expression mode and use `parseVariables`, eg `parseVariables("Gain[1.2.$(internal:custom_channel)]")`. The path field of the matrix actions is text, and takes variables directly.

## Value Fields

For Set Value Actions one must ensure the correct data type is selected. In particular confusion can occur between Integer and ENUM types.

Set Value Integer and Set Value Real take the value as it is displayed. The parameter's formula converts it to the device's value; an integer without one is multiplied by its factor, and rounded to a whole number. A relative change is made to the displayed value. The Minimum and Maximum of a relative change are the device's values, not as displayed. This replaces Set Value Integer's Factor option of earlier versions; Learn fills in the displayed value. On upgrading, an action whose Factor was 1 takes the displayed value from then on, so check those on parameters with a factor or formula. An action with any other Factor keeps it, with **Device Units** ticked, and goes on sending its value multiplied by that Factor, as it did; untick Device Units, or use Learn, to give it the displayed value.

Set Value ENUM finds an entry by name in the parameter's enumeration map, or else its enumeration, so a device whose entries aren't numbered from 0 is set correctly. An entry whose name begins with `~` is found with or without the `~`. A relative change steps through the entries in their order, passing over any outside the Minimum and Maximum.

Any value field can be switched to expression mode to set it from variables or an expression, eg `$(internal:custom_level) * 2`. This replaces the `Use Variable?` and `Path from String` options of earlier versions, which are converted automatically when the module is upgraded. An expression for a number field must give a number within the field's range, or the action is skipped. An expression for a checkbox is read as true or false, so for a variable holding text such as `on` or `off` use eg `!arrayIncludes(['', 'false', 'off', '0'], toLowerCase($(internal:custom_state)))`.

## Functions

Ember+ devices may expose executable functions (such as triggering snapshots, firing macros, or executing remote methods).

- **Invoke Function**: Invokes an Ember+ `Function` node on the target device. Arguments can be passed comma-separated (e.g. `123, "text", true`), line-separated, or as a JSON array (e.g. `[123, "text", true]`). Dynamic Companion variables are supported.

## Actions

- Set Value Integer
- Set Value Real
- Set Value Boolean
- Set Value ENUM
- Set Value String
- Invoke Function
- Matrix Connect
- Matrix Disconnect
- Matrix Set Connection
- Take
- Clear
- Set Selected Source
- Set Selected Target
- Set Host

## Host

The host and port the module is configured to connect to are exposed as the `host` and `port` variables. They can be changed at runtime with the **Set Host** action, which saves the new values to the module config and reconnects. As the action sets the host directly, it also clears any device selected via Bonjour.

The host accepts variables, and may be left empty to keep the currently configured host, so the action can change the port alone. The port is a number from 1 to 65535; switch it to expression mode to set it from a variable. The action will fail if the host is not a plausible hostname or IP. Set Host actions from earlier versions with an empty port take the port the connection had when the module was upgraded. Use the action's **Learn** button to reset both fields to the values the module is currently configured with.

## Feedbacks

- Parameter Property
- Parameter Compare Number (Deprecated)
- Parameter Equals String (Deprecated)
- Parameter ENUM Equals String (Deprecated)
- Parameter True (Deprecated)
- Take is possible
- Clear is possible
- Source Background If Selected
- Target Background if Selected

### Parameter Property

Returns a property of a parameter to a button's local variable, chosen from:

- **Value**: integers divided by their factor, as the Parameter Value feedback of earlier versions returned them. Octet strings are returned as an array of bytes.
- **Value with Units**: the value by its formula or factor, formatted by the parameter's format, with its unit, eg `-12.5 dB`.
- **Value by Formula**: the value computed by the parameter's formula. A parameter without a formula returns its plain value.
- **Value as Enumeration Entry**: the name of the value's entry, from the parameter's enumeration map or enumeration. A parameter with neither returns its plain value. This replaces the Return ENUM checkbox of earlier versions.
- The parameter's own properties, as the provider reports them: Identifier, Description, Type, Access, Minimum, Maximum, Default Value, Factor, Format, Step, Online, Stream Identifier, Stream Descriptor, Schema Identifiers and Template Reference. A property the provider doesn't report returns nothing.

Use it in an expression to style a button, or compare the value, in place of the deprecated feedbacks.

### Deprecated feedbacks

Parameter Compare Number, Parameter Equals String, Parameter ENUM Equals String and Parameter True are deprecated, and will be removed in a future release. Use Parameter Property in an expression instead.

Parameter Compare Number, Parameter Equals String, and Parameter True type coerce all data to the respective data type, thus can be used on any node type. Ie, you can check a boolean node with the Parameter Equals String feedback by setting the Value to _true_. However, the path dropdown for each feedback is filtered to parameters of the appropriate type(s) for ease of use. Prior to version 2.5 all data was coerced to strings prior to equality tests. The path field of each feedback presents a dropdown of registered paths. New paths can be typed in, or built from variables in expression mode, and if valid will be automatically registered and added to the dropdowns and, with Parameter - Values selected, the variable list.

## Presets

- Take
- Clear

## Action Recorder

The Action Recorder can record Set Value actions for ember parameters you are currently subscribed to.
