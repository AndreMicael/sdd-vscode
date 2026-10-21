# Private process wrapper: no installation policy or persistent state lives here.
# Assign this process to a kill-on-close job BEFORE starting the requested tool.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SddProcessJob {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    // Keep the handle open for this process lifetime; never inherit it in children.
    static IntPtr handle;
    public static void Enter() {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        var limits = new ExtendedLimits();
        limits.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        int size = Marshal.SizeOf(limits);
        IntPtr info = Marshal.AllocHGlobal(size);
        try {
            Marshal.StructureToPtr(limits, info, false);
            if (!SetInformationJobObject(handle, 9, info, (uint)size)) throw new System.ComponentModel.Win32Exception();
            if (!AssignProcessToJobObject(handle, GetCurrentProcess())) throw new System.ComponentModel.Win32Exception();
        } finally { Marshal.FreeHGlobal(info); }
    }
}
'@
[SddProcessJob]::Enter()
$sddExecutable = $env:SDD_PROCESS_EXE
$sddArguments = @(ConvertFrom-Json $env:SDD_PROCESS_ARGS)
Remove-Item Env:SDD_PROCESS_EXE, Env:SDD_PROCESS_ARGS
& $sddExecutable @sddArguments
exit $LASTEXITCODE
