import tkinter as tk
from tkinter import filedialog, messagebox
import os
import shutil
import threading
import tkinter.ttk as ttk # 匯入 ttk
import json # 匯入 json
import datetime # 匯入 datetime

# --- 設定區 ---
# 預設排除規則 - 如果設定檔沒有會用這些
DEFAULT_EXCLUDED_FOLDERS_EXACT = {".git", "node_modules"}
DEFAULT_EXCLUDED_FOLDERS_PREFIX = {"firebase-export-"}
# --- 設定區結束 ---

# 設定檔名稱
CONFIG_FILE = "config.json"

# 將排除列表轉換為小寫，方便比較 - 現在由 load_config 初始化
EXCLUDED_FOLDERS_EXACT_LOWER = set()
EXCLUDED_FOLDERS_PREFIX_LOWER = set()
# 全域變數儲存原始大小寫的排除列表，用於編輯器
excluded_exact_list = []
excluded_prefix_list = []

# --- 全域變數 ---
source_dir_var = None
dest_dir_var = None
status_label_var = None
calculate_button = None
copy_button = None
files_to_copy_list = []
total_files_count = 0
progress_bar = None # 新增進度條變數
preview_button = None # 新增預覽按鈕變數
editor_button = None # 新增編輯規則按鈕
append_timestamp_var = None # 新增時間戳記開關變數
calculate_full_button = None # 新增計算完整按鈕變數
last_calculation_mode = None # 追蹤上次計算模式 ('selective' or 'full')

# --- 核心功能函式 ---

def get_actual_dest_dir():
    """根據時間戳記開關狀態獲取實際的目標資料夾路徑"""
    base_dest_dir = dest_dir_var.get()
    if not base_dest_dir:
        return None # 如果基礎路徑未設定，返回 None

    if append_timestamp_var and append_timestamp_var.get():
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        # 嘗試從基礎路徑分離檔名和副檔名（如果有的話），將時間戳加在名稱後面
        base_name, ext = os.path.splitext(os.path.basename(base_dest_dir))
        dir_name = os.path.dirname(base_dest_dir)
        # 組合新的帶時間戳記的名稱
        new_name = f"{base_name}_{timestamp}{ext}" if ext else f"{base_name}_{timestamp}"
        return os.path.join(dir_name, new_name)
    else:
        return base_dest_dir

def is_excluded(folder_name):
    """檢查資料夾名稱是否應該被排除 (使用全域小寫集合)"""
    lower_name = folder_name.lower()
    if lower_name in EXCLUDED_FOLDERS_EXACT_LOWER:
        return True
    for prefix in EXCLUDED_FOLDERS_PREFIX_LOWER:
        if lower_name.startswith(prefix):
            return True
    return False

def select_directory(dir_var, title="選擇資料夾"):
    """開啟資料夾選擇對話框並更新變數"""
    directory = filedialog.askdirectory(title=title)
    if directory:
        dir_var.set(directory)
        # 清除計算結果，因為來源或目標已變更
        reset_calculation()
        # 儲存設定 (包含路徑和規則)
        save_config()

def reset_calculation():
    """重置計算狀態和按鈕"""
    global files_to_copy_list, total_files_count
    files_to_copy_list = []
    total_files_count = 0
    status_label_var.set("請先選擇來源和目標資料夾，然後計算檔案數量。(可編輯排除規則或開啓時間戳記)")
    copy_button.config(state=tk.DISABLED)
    calculate_button.config(state=tk.NORMAL)
    if progress_bar: # 重置進度條
        progress_bar['value'] = 0
        progress_bar['maximum'] = 100 # 預設值
    if preview_button: # 重置預覽按鈕
        preview_button.config(state=tk.DISABLED)
    # 新增：重置計算模式和完整計算按鈕狀態
    global last_calculation_mode
    last_calculation_mode = None
    if calculate_full_button:
        calculate_full_button.config(state=tk.NORMAL)

def calculate_files_to_copy():
    """計算需要複製的檔案數量和列表 (排除模式)"""
    # 呼叫內部計算函式，忽略排除設為 False
    _start_file_calculation(ignore_exclusions=False, mode='selective')

def calculate_files_for_full_copy():
    """計算需要複製的檔案數量和列表 (完整模式)"""
    # 呼叫內部計算函式，忽略排除設為 True
    _start_file_calculation(ignore_exclusions=True, mode='full')

def _start_file_calculation(ignore_exclusions, mode):
    """啟動檔案計算的線程 (內部使用)"""
    global files_to_copy_list, total_files_count, last_calculation_mode
    source_dir = source_dir_var.get()
    actual_dest_dir = get_actual_dest_dir()

    if not source_dir or not actual_dest_dir:
        messagebox.showerror("錯誤", "請先選擇來源和目標資料夾！")
        return

    if not os.path.isdir(source_dir):
         messagebox.showerror("錯誤", f"來源資料夾不存在或無效：\n{source_dir}")
         return

    # 檢查目標是否為來源的子資料夾
    try:
        if source_dir == actual_dest_dir or os.path.commonpath([source_dir]) == os.path.commonpath([source_dir, actual_dest_dir]):
             messagebox.showerror("錯誤", "目標資料夾不能是來源資料夾本身或其子資料夾！")
             return
    except ValueError: # 如果路徑在不同磁碟機會引發 ValueError
        pass # 不同磁碟機則肯定不是子資料夾

    files_to_copy_list = []
    total_files_count = 0
    last_calculation_mode = mode # 記錄本次計算模式
    mode_text = "(完整模式)" if ignore_exclusions else "(排除模式)"
    status_label_var.set(f"正在計算檔案數量 {mode_text}...")

    # 禁用所有計算和複製按鈕
    calculate_button.config(state=tk.DISABLED)
    if calculate_full_button:
        calculate_full_button.config(state=tk.DISABLED)
    copy_button.config(state=tk.DISABLED)
    if preview_button:
        preview_button.config(state=tk.DISABLED)
    if progress_bar:
        progress_bar['value'] = 0

    # 使用 threading 避免 GUI 卡住
    def calculation_thread():
        global total_files_count
        try:
            count = 0
            temp_file_list = []
            for dirpath, dirs, files in os.walk(source_dir, topdown=True):
                # --- 核心排除/完整邏輯 --- #
                if not ignore_exclusions:
                    # 只有在非忽略排除模式下才修改 dirs
                    dirs[:] = [d for d in dirs if not is_excluded(d)]
                # --- 邏輯結束 --- #

                for file in files:
                    source_path = os.path.join(dirpath, file)
                    relative_path = os.path.relpath(source_path, source_dir)
                    dest_path = os.path.join(actual_dest_dir, relative_path)
                    temp_file_list.append((source_path, dest_path))
                    count += 1

            # 計算完成後，在主線程更新全域變數和 UI
            root.after(0, lambda fl=temp_file_list, c=count: update_calculation_result(fl, c))

        except Exception as e:
             # 使用輔助函式處理錯誤
             root.after(0, lambda err=e, mt=mode_text: handle_calculation_error(err, mt))

    # 啟動計算線程
    thread = threading.Thread(target=calculation_thread, daemon=True)
    thread.start()

def update_calculation_result(calculated_list, calculated_count):
    """在主線程中更新計算結果的 UI"""
    global files_to_copy_list, total_files_count, last_calculation_mode
    files_to_copy_list = calculated_list
    total_files_count = calculated_count

    mode_text = "(完整模式)" if last_calculation_mode == 'full' else "(排除模式)"

    if total_files_count > 0:
        status_label_var.set(f"計算完成 {mode_text}！總共需要複製 {total_files_count} 個檔案。可以開始複製。")
        copy_button.config(state=tk.NORMAL)
        if preview_button:
            preview_button.config(state=tk.NORMAL)
        if progress_bar:
            progress_bar['maximum'] = total_files_count
            progress_bar['value'] = 0
    else:
        status_label_var.set(f"計算完成 {mode_text}，沒有找到需要複製的檔案（或來源為空）。")
        copy_button.config(state=tk.DISABLED)
        if preview_button:
            preview_button.config(state=tk.DISABLED)

    # 恢復計算按鈕
    calculate_button.config(state=tk.NORMAL)
    if calculate_full_button:
        calculate_full_button.config(state=tk.NORMAL)

# 新增：處理計算錯誤的輔助函式
def handle_calculation_error(error, mode_text):
    """在主線程處理計算錯誤並顯示訊息"""
    error_msg = f"計算檔案時發生錯誤 {mode_text}：\n{error}"
    show_error_and_reset(error_msg)

def show_error_and_reset(error_message):
    """顯示錯誤訊息並重置狀態"""
    messagebox.showerror("錯誤", error_message)
    reset_calculation()

def start_copying():
    """開始執行複製操作"""
    global files_to_copy_list, total_files_count
    if not files_to_copy_list:
        messagebox.showwarning("提示", "沒有需要複製的檔案，請先計算檔案數量。")
        return

    # --- 修改：使用實際目標路徑確認 --- #
    actual_dest_dir = get_actual_dest_dir()
    if not actual_dest_dir:
        messagebox.showerror("錯誤", "無法獲取目標資料夾路徑！")
        return

    confirm_message = f"確定要將 {total_files_count} 個檔案從\n{source_dir_var.get()}\n複製到\n{actual_dest_dir}\n嗎？\n(目標資料夾內若有同名檔案將被覆蓋)"
    if not messagebox.askyesno("確認複製", confirm_message):
        return
    # --- 修改結束 --- #

    status_label_var.set(f"正在複製 0 / {total_files_count} 個檔案...")
    calculate_button.config(state=tk.DISABLED)
    copy_button.config(state=tk.DISABLED)

    # 使用 threading 避免 GUI 卡住
    def copy_thread():
        copied_count = 0
        try:
            for i, (src_path, dest_path) in enumerate(files_to_copy_list):
                # 確保目標路徑的目錄存在
                dest_folder = os.path.dirname(dest_path)
                os.makedirs(dest_folder, exist_ok=True)

                # 複製檔案 (copy2 會盡量保留原始檔案的 metadata)
                shutil.copy2(src_path, dest_path)
                copied_count += 1

                # 更新進度 (不需要太頻繁，避免拖慢)
                # 同時更新進度條和標籤
                update_interval = max(1, total_files_count // 100) # 大約更新100次或每個都更新（如果檔案少）
                if (i + 1) % update_interval == 0 or (i + 1) == total_files_count:
                     final_count = copied_count # 捕獲當前計數
                     root.after(0, lambda c=final_count: update_progress(c, total_files_count))

            # 完成後更新狀態
            root.after(0, show_copy_complete)

        except Exception as e:
             # 修正 lambda 錯誤
            root.after(0, lambda err=e: show_error_and_reset(f"複製檔案時發生錯誤：\n{err}"))


    # 啟動複製線程
    thread = threading.Thread(target=copy_thread, daemon=True)
    thread.start()


def show_copy_complete():
     """顯示複製完成訊息"""
     global total_files_count
     messagebox.showinfo("完成", f"複製完成！\n成功複製 {total_files_count} 個檔案。")
     status_label_var.set(f"複製完成！共複製 {total_files_count} 個檔案。")
     if progress_bar: # 確保進度條顯示為完成
         progress_bar['value'] = total_files_count
     # 可以選擇重置或保留狀態
     # reset_calculation() # 如果希望每次複製完都重置
     calculate_button.config(state=tk.NORMAL) # 允許重新計算或修改路徑

def update_progress(current_count, total_count):
    """更新進度條和狀態標籤"""
    if progress_bar:
        progress_bar['value'] = current_count
    status_label_var.set(f"正在複製 {current_count} / {total_count} 個檔案...")

# --- 檔案預覽功能 ---
def show_file_preview():
    """顯示將要複製的檔案列表預覽視窗"""
    global files_to_copy_list, source_dir_var, total_files_count

    if not files_to_copy_list:
        messagebox.showinfo("預覽", "目前沒有計算出需要複製的檔案。")
        return

    source_dir = source_dir_var.get()
    if not source_dir:
        messagebox.showerror("錯誤", "無法獲取來源資料夾路徑以顯示相對路徑。")
        return

    preview_window = tk.Toplevel(root)
    preview_window.title(f"預覽複製檔案 ({total_files_count} 個)")
    preview_window.geometry("600x400") # 設定預設大小

    # 加入來源和目標路徑標籤
    path_frame = tk.Frame(preview_window)
    path_frame.pack(pady=5, fill=tk.X, padx=10)
    tk.Label(path_frame, text=f"來源: {source_dir}").pack(anchor='w')
    # tk.Label(path_frame, text=f"目標: {dest_dir_var.get()}").pack(anchor='w') # 目標路徑可選顯示

    # 建立 Listbox 和 Scrollbar
    list_frame = tk.Frame(preview_window)
    list_frame.pack(expand=True, fill=tk.BOTH, padx=10, pady=5)

    scrollbar_y = tk.Scrollbar(list_frame, orient=tk.VERTICAL)
    scrollbar_x = tk.Scrollbar(list_frame, orient=tk.HORIZONTAL)
    listbox = tk.Listbox(list_frame,
                        yscrollcommand=scrollbar_y.set,
                        xscrollcommand=scrollbar_x.set,
                        selectmode=tk.EXTENDED)

    scrollbar_y.config(command=listbox.yview)
    scrollbar_x.config(command=listbox.xview)

    scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
    scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
    listbox.pack(side=tk.LEFT, expand=True, fill=tk.BOTH)

    # 填充 Listbox
    try:
        for src_path, _ in files_to_copy_list:
            relative_path = os.path.relpath(src_path, source_dir)
            listbox.insert(tk.END, relative_path)
    except ValueError as e:
        messagebox.showerror("錯誤", f"計算相對路徑時出錯: {e}\n請確保來源路徑有效。")
        preview_window.destroy()
        return

    # 關閉按鈕
    close_button = tk.Button(preview_window, text="關閉", command=preview_window.destroy)
    close_button.pack(pady=10)

    # 讓預覽視窗成為焦點
    preview_window.transient(root) # 依附主視窗
    preview_window.grab_set()      # 獨佔焦點
    root.wait_window(preview_window) # 等待視窗關閉


# --- 路徑與設定存取功能 ---
def load_config():
    """載入設定檔 (路徑和排除規則)"""
    global source_dir_var, dest_dir_var, excluded_exact_list, excluded_prefix_list
    global EXCLUDED_FOLDERS_EXACT_LOWER, EXCLUDED_FOLDERS_PREFIX_LOWER
    global append_timestamp_var # 包含時間戳記變數

    config = {}
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"讀取設定檔 {CONFIG_FILE} 時發生錯誤: {e}")
        # 即使讀取失敗也繼續，使用預設值或空值啟動
    except Exception as e:
        print(f"載入設定時發生未預期錯誤: {e}")

    # 載入路徑
    source_dir = config.get('source_dir', '')
    dest_dir = config.get('dest_dir', '')
    if source_dir and os.path.isdir(source_dir):
        source_dir_var.set(source_dir)
    if dest_dir and os.path.isdir(dest_dir):
         dest_dir_var.set(dest_dir)

    # 載入排除規則 (若無則使用預設值)
    excluded_exact_list = config.get('excluded_exact', list(DEFAULT_EXCLUDED_FOLDERS_EXACT))
    excluded_prefix_list = config.get('excluded_prefix', list(DEFAULT_EXCLUDED_FOLDERS_PREFIX))

    # 更新小寫集合供 is_excluded 使用
    EXCLUDED_FOLDERS_EXACT_LOWER = {f.lower() for f in excluded_exact_list}
    EXCLUDED_FOLDERS_PREFIX_LOWER = {p.lower() for p in excluded_prefix_list}

    # 載入時間戳記開關狀態
    if append_timestamp_var:
        append_timestamp_var.set(config.get('append_timestamp', False))

def save_config():
    """儲存目前的設定 (路徑、排除規則和時間戳記開關)"""
    global excluded_exact_list, excluded_prefix_list, append_timestamp_var # 包含時間戳記變數
    config = {
        'source_dir': source_dir_var.get(),
        'dest_dir': dest_dir_var.get(),
        'excluded_exact': excluded_exact_list,
        'excluded_prefix': excluded_prefix_list,
        'append_timestamp': append_timestamp_var.get() if append_timestamp_var else False # 儲存開關狀態
    }
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except IOError as e:
        print(f"儲存設定檔 {CONFIG_FILE} 時發生錯誤: {e}")
    except Exception as e:
        print(f"儲存設定時發生未預期錯誤: {e}")

# --- 排除規則編輯器 --- #
def show_exclusion_editor():
    """顯示排除規則編輯視窗"""
    global excluded_exact_list, excluded_prefix_list
    global EXCLUDED_FOLDERS_EXACT_LOWER, EXCLUDED_FOLDERS_PREFIX_LOWER

    editor_window = tk.Toplevel(root)
    editor_window.title("編輯排除規則")
    editor_window.geometry("500x450")
    editor_window.transient(root)
    editor_window.grab_set()

    # --- 內部 Helper 函式 ---
    def update_lower_sets():
        """根據目前的列表更新小寫集合"""
        global EXCLUDED_FOLDERS_EXACT_LOWER, EXCLUDED_FOLDERS_PREFIX_LOWER
        EXCLUDED_FOLDERS_EXACT_LOWER = {f.lower() for f in excluded_exact_list}
        EXCLUDED_FOLDERS_PREFIX_LOWER = {p.lower() for p in excluded_prefix_list}

    def add_item(entry_widget, listbox_widget, target_list):
        item = entry_widget.get().strip()
        if item and item not in target_list:
            target_list.append(item)
            listbox_widget.insert(tk.END, item)
            entry_widget.delete(0, tk.END)
            update_lower_sets() # 更新集合
        elif item in target_list:
            messagebox.showwarning("提示", f"'{item}' 已存在於列表中。", parent=editor_window)
        else:
            messagebox.showwarning("提示", "請輸入要新增的項目。", parent=editor_window)

    def remove_selected(listbox_widget, target_list):
        selected_indices = listbox_widget.curselection()
        if not selected_indices:
            messagebox.showwarning("提示", "請先選擇要移除的項目。", parent=editor_window)
            return
        # 從後往前刪除，避免索引變化問題
        for i in reversed(selected_indices):
            item_to_remove = listbox_widget.get(i)
            listbox_widget.delete(i)
            if item_to_remove in target_list:
                target_list.remove(item_to_remove)
        update_lower_sets() # 更新集合

    def save_and_close():
        save_config() # 儲存目前的規則
        editor_window.destroy()
        # 如果之前計算過，提示需要重新計算
        if total_files_count > 0 or files_to_copy_list:
            reset_calculation() # 清除舊結果
            status_label_var.set("排除規則已變更，請重新計算檔案數量。")
            messagebox.showinfo("提示", "排除規則已儲存。\n由於規則已變更，請重新點擊 '計算檔案數量'。", parent=root)

    def cancel_and_close():
        # 取消時不儲存，但需要恢復到上次儲存的狀態 (重新載入)
        load_config() # 重新載入確保全域變數是儲存的狀態
        editor_window.destroy()

    # --- 編輯器介面佈局 ---
    main_editor_frame = tk.Frame(editor_window, padx=10, pady=10)
    main_editor_frame.pack(expand=True, fill=tk.BOTH)

    # 分成左右兩欄
    left_frame = tk.Frame(main_editor_frame)
    right_frame = tk.Frame(main_editor_frame)
    left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
    right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5)

    # --- 精確排除 (左欄) ---
    tk.Label(left_frame, text="精確排除資料夾名稱:").pack(anchor='w')
    exact_list_frame = tk.Frame(left_frame)
    exact_list_frame.pack(fill=tk.BOTH, expand=True)
    exact_scrollbar = tk.Scrollbar(exact_list_frame)
    exact_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    exact_listbox = tk.Listbox(exact_list_frame, yscrollcommand=exact_scrollbar.set, selectmode=tk.EXTENDED)
    exact_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    exact_scrollbar.config(command=exact_listbox.yview)
    for item in excluded_exact_list:
        exact_listbox.insert(tk.END, item)

    exact_input_frame = tk.Frame(left_frame)
    exact_input_frame.pack(fill=tk.X, pady=5)
    exact_entry = tk.Entry(exact_input_frame)
    exact_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
    exact_add_button = tk.Button(exact_input_frame, text="新增", command=lambda: add_item(exact_entry, exact_listbox, excluded_exact_list))
    exact_add_button.pack(side=tk.LEFT)
    exact_remove_button = tk.Button(left_frame, text="移除選定", command=lambda: remove_selected(exact_listbox, excluded_exact_list))
    exact_remove_button.pack(fill=tk.X)

    # --- 前綴排除 (右欄) ---
    tk.Label(right_frame, text="排除資料夾名稱前綴:").pack(anchor='w')
    prefix_list_frame = tk.Frame(right_frame)
    prefix_list_frame.pack(fill=tk.BOTH, expand=True)
    prefix_scrollbar = tk.Scrollbar(prefix_list_frame)
    prefix_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    prefix_listbox = tk.Listbox(prefix_list_frame, yscrollcommand=prefix_scrollbar.set, selectmode=tk.EXTENDED)
    prefix_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    prefix_scrollbar.config(command=prefix_listbox.yview)
    for item in excluded_prefix_list:
        prefix_listbox.insert(tk.END, item)

    prefix_input_frame = tk.Frame(right_frame)
    prefix_input_frame.pack(fill=tk.X, pady=5)
    prefix_entry = tk.Entry(prefix_input_frame)
    prefix_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
    prefix_add_button = tk.Button(prefix_input_frame, text="新增", command=lambda: add_item(prefix_entry, prefix_listbox, excluded_prefix_list))
    prefix_add_button.pack(side=tk.LEFT)
    prefix_remove_button = tk.Button(right_frame, text="移除選定", command=lambda: remove_selected(prefix_listbox, excluded_prefix_list))
    prefix_remove_button.pack(fill=tk.X)

    # --- 底部按鈕 --- #
    bottom_frame = tk.Frame(main_editor_frame)
    bottom_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=(10, 0))
    save_button = tk.Button(bottom_frame, text="儲存並關閉", command=save_and_close)
    save_button.pack(side=tk.RIGHT, padx=5)
    cancel_button = tk.Button(bottom_frame, text="取消", command=cancel_and_close)
    cancel_button.pack(side=tk.RIGHT)

    # --- 綁定 Enter 鍵 --- #
    exact_entry.bind("<Return>", lambda event: add_item(exact_entry, exact_listbox, excluded_exact_list))
    prefix_entry.bind("<Return>", lambda event: add_item(prefix_entry, prefix_listbox, excluded_prefix_list))

    # --- 等待視窗關閉 ---
    root.wait_window(editor_window)



# --- GUI 設定 ---
root = tk.Tk()
root.title("專案檔案選擇性複製工具")

# 設定 StringVars
source_dir_var = tk.StringVar()
dest_dir_var = tk.StringVar()
status_label_var = tk.StringVar()

# --- 新增：時間戳記開關變數 --- #
append_timestamp_var = tk.BooleanVar()
# --- 新增結束 --- #

# 載入設定檔 (路徑、排除規則和時間戳記狀態)
load_config()

# --- 介面佈局 ---
main_frame = tk.Frame(root, padx=10, pady=10)
main_frame.pack(fill=tk.BOTH, expand=True)

# 來源資料夾
source_frame = tk.Frame(main_frame)
source_frame.pack(fill=tk.X, pady=5)
tk.Label(source_frame, text="來源專案資料夾:").pack(side=tk.LEFT, padx=5)
source_entry = tk.Entry(source_frame, textvariable=source_dir_var, width=50)
source_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
tk.Button(source_frame, text="瀏覽...", command=lambda: select_directory(source_dir_var, "選擇來源專案資料夾")).pack(side=tk.LEFT)

# 目標資料夾
dest_frame = tk.Frame(main_frame)
dest_frame.pack(fill=tk.X, pady=5)
tk.Label(dest_frame, text="複製到目標資料夾:").pack(side=tk.LEFT, padx=5)
dest_entry = tk.Entry(dest_frame, textvariable=dest_dir_var, width=50)
dest_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
tk.Button(dest_frame, text="瀏覽...", command=lambda: select_directory(dest_dir_var, "選擇儲存複製檔案的資料夾")).pack(side=tk.LEFT)

# 操作按鈕
button_frame = tk.Frame(main_frame)
button_frame.pack(pady=10)
calculate_button = tk.Button(button_frame, text="計算檔案數量 (排除)", command=calculate_files_to_copy) # 修改按鈕文字
calculate_button.pack(side=tk.LEFT, padx=5) # 調整 padding
# 新增計算 (完整) 按鈕
calculate_full_button = tk.Button(button_frame, text="計算檔案數量 (完整)", command=calculate_files_for_full_copy)
calculate_full_button.pack(side=tk.LEFT, padx=5)
copy_button = tk.Button(button_frame, text="開始複製", command=start_copying, state=tk.DISABLED)
copy_button.pack(side=tk.LEFT, padx=5)
preview_button = tk.Button(button_frame, text="預覽檔案", command=show_file_preview, state=tk.DISABLED)
preview_button.pack(side=tk.LEFT, padx=5)

# 編輯規則按鈕移到按鈕區
editor_button = tk.Button(button_frame, text="編輯排除規則", command=show_exclusion_editor)
editor_button.pack(side=tk.LEFT, padx=5)

# --- 新增：時間戳記 Checkbutton --- #
timestamp_check = tk.Checkbutton(main_frame, text="目標資料夾附加時間戳記 (例如：目標_YYYYMMDD_HHMMSS)",
                                 variable=append_timestamp_var,
                                 command=save_config) # 點擊即儲存狀態
timestamp_check.pack(pady=5, anchor='w')
# --- 新增結束 --- #

# 進度條
progress_bar = ttk.Progressbar(main_frame, orient=tk.HORIZONTAL, length=300, mode='determinate')
progress_bar.pack(pady=10, fill=tk.X)

# 狀態顯示
status_label = tk.Label(main_frame, textvariable=status_label_var, justify=tk.LEFT, wraplength=450) # wraplength 自動換行
status_label.pack(pady=5, fill=tk.X) # 調整 padding

# 初始化狀態
reset_calculation()

# --- 啟動 GUI ---
root.mainloop()